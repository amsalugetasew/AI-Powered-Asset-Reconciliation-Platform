from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import pandas as pd
import json

from models import db, Reconciliation, ReconciliationRecord, User
from services.reconciliation_service import ReconciliationService
from services.audit_service import AuditService
from utils.rbac import require_role, get_user_from_token, get_user_role
from config import Config

reconciliation_bp = Blueprint('reconciliation', __name__, url_prefix='/api/reconciliation')

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def _auto_save_records(reconciliation_id, report_path):
    """
    Parse the Excel report and save all records to DB with approval_status='pending'.
    Clears existing records for this reconciliation first (idempotent).
    """
    if not report_path or not os.path.exists(report_path):
        print(f"_auto_save_records: report not found at {report_path}")
        return 0

    # Delete existing records (re-run safe)
    ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation_id).delete()
    db.session.flush()

    sheet_mapping = {
        'Exact_Matched_By_Tag': 'Exact Match',
        'AI_Matched_Need_Manual_Review': 'AI Match',
        'Matched_Need_Manual_Review': 'Manual Review',
        'Customer_Unmatched': 'Customer Unmatched',
        'Finance_Unmatched': 'Finance Unmatched',
        'Customer_Duplicates': 'Duplicate',
        'Finance_Duplicates': 'Duplicate'
    }

    excel_file = pd.ExcelFile(report_path)
    records_to_insert = []

    for sheet_name, match_type in sheet_mapping.items():
        if sheet_name not in excel_file.sheet_names:
            continue
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        if 'Message' in df.columns and len(df.columns) == 1:
            continue

        for _, row in df.iterrows():
            row_dict = row.to_dict()
            cleaned = {k: (None if pd.isna(v) else v) for k, v in row_dict.items()}

            record = ReconciliationRecord(
                reconciliation_id=reconciliation_id,
                match_category=match_type,
                full_record_json=cleaned,
                approval_status='pending'
            )
            records_to_insert.append(record)

    if records_to_insert:
        db.session.bulk_save_objects(records_to_insert)
    db.session.commit()
    print(f"_auto_save_records: saved {len(records_to_insert)} records for reconciliation {reconciliation_id}")
    return len(records_to_insert)

@reconciliation_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_files():
    """Upload customer and internal Excel files"""
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        
        # Check if files are present
        if 'customer_file' not in request.files or 'internal_file' not in request.files:
            return jsonify({'error': 'Both customer and internal files are required'}), 400
        
        customer_file = request.files['customer_file']
        internal_file = request.files['internal_file']
        
        # Validate files
        if customer_file.filename == '' or internal_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(customer_file.filename) or not allowed_file(internal_file.filename):
            return jsonify({'error': 'Only Excel files (.xlsx, .xls) are allowed'}), 400
        
        # Save files
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        customer_filename = secure_filename(f'customer_{timestamp}_{customer_file.filename}')
        internal_filename = secure_filename(f'internal_{timestamp}_{internal_file.filename}')
        
        customer_path = os.path.join(Config.UPLOAD_FOLDER, customer_filename)
        internal_path = os.path.join(Config.UPLOAD_FOLDER, internal_filename)
        
        customer_file.save(customer_path)
        internal_file.save(internal_path)
        
        # Create reconciliation record
        reconciliation = Reconciliation(
            user_id=user_id,
            customer_file=customer_filename,
            internal_file=internal_filename,
            status='pending'
        )
        
        db.session.add(reconciliation)
        db.session.commit()
        
        return jsonify({
            'message': 'Files uploaded successfully',
            'reconciliation_id': reconciliation.id,
            'reconciliation': reconciliation.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/process/<int:reconciliation_id>', methods=['POST'])
@jwt_required()
def process_reconciliation(reconciliation_id):
    """Process reconciliation for uploaded files"""
    reconciliation = None
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        
        # Get reconciliation record
        reconciliation = Reconciliation.query.filter_by(
            id=reconciliation_id,
            user_id=user_id
        ).first()
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        if reconciliation.status != 'pending':
            return jsonify({'error': 'Reconciliation already processed'}), 400
        
        # Update status
        reconciliation.status = 'processing'
        db.session.commit()
        
        # Get file paths
        customer_path = os.path.join(Config.UPLOAD_FOLDER, reconciliation.customer_file)
        internal_path = os.path.join(Config.UPLOAD_FOLDER, reconciliation.internal_file)
        
        # Verify files exist
        if not os.path.exists(customer_path):
            raise FileNotFoundError(f"Customer file not found: {customer_path}")
        if not os.path.exists(internal_path):
            raise FileNotFoundError(f"Internal file not found: {internal_path}")
        
        # Process reconciliation
        service = ReconciliationService(Config)
        statistics = service.process_reconciliation(
            customer_path,
            internal_path,
            reconciliation_id
        )
        
        # Update reconciliation record
        reconciliation.status = 'completed'
        reconciliation.completed_at = datetime.utcnow()
        reconciliation.total_customer_records = statistics['total_customer_records']
        reconciliation.total_internal_records = statistics['total_internal_records']
        reconciliation.rule_matched = statistics['rule_matched']
        reconciliation.ai_matched = statistics['ai_matched']
        reconciliation.manual_review = statistics['manual_review']
        reconciliation.customer_unmatched = statistics['customer_unmatched']
        reconciliation.internal_unmatched = statistics['internal_unmatched']
        
        # Handle duplicate columns safely (they might not exist in old databases)
        if hasattr(reconciliation, 'customer_duplicates'):
            reconciliation.customer_duplicates = statistics.get('customer_duplicates', 0)
        if hasattr(reconciliation, 'internal_duplicates'):
            reconciliation.internal_duplicates = statistics.get('internal_duplicates', 0)
            
        reconciliation.report_path = statistics['report_path']
        
        db.session.commit()

        # Auto-save records to database immediately after processing
        try:
            _auto_save_records(reconciliation_id, statistics['report_path'])
        except Exception as save_err:
            import traceback
            print(f"Warning: auto-save records failed: {save_err}")
            traceback.print_exc()
        
        return jsonify({
            'message': 'Reconciliation completed successfully',
            'reconciliation': reconciliation.to_dict()
        }), 200
        
    except Exception as e:
        # Log the full error
        import traceback
        print("ERROR in process_reconciliation:")
        print(traceback.format_exc())
        
        # Update status to failed
        if reconciliation:
            reconciliation.status = 'failed'
            db.session.commit()
        
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/list', methods=['GET'])
@jwt_required()
def list_reconciliations():
    """
    List reconciliations based on user role.
    
    Officers: See only their own reconciliations
    Managers/Admins: See all reconciliations system-wide
    """
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        user_role = get_user_role()
        
        # Role-based filtering
        if user_role in ['manager', 'admin']:
            # Managers and admins see all reconciliations
            reconciliations = Reconciliation.query\
                .order_by(Reconciliation.created_at.desc()).all()
            scope = 'all'
        else:
            # Officers see only their own
            reconciliations = Reconciliation.query.filter_by(user_id=user_id)\
                .order_by(Reconciliation.created_at.desc()).all()
            scope = 'own'
        
        return jsonify({
            'reconciliations': [r.to_dict() for r in reconciliations],
            'scope': scope,
            'role': user_role
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_reconciliation(reconciliation_id):
    """
    Get specific reconciliation details.
    
    Officers: Can only view their own reconciliations
    Managers/Admins: Can view any reconciliation
    """
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        user_role = get_user_role()
        
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own reconciliations.'
            }), 403
        
        return jsonify({
            'reconciliation': reconciliation.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/download/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def download_report(reconciliation_id):
    """
    Download reconciliation report.
    
    Officers: Can only download their own reports
    Managers/Admins: Can download any report
    """
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        user_role = get_user_role()
        
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only download your own reports.'
            }), 403
        
        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Report not found'}), 404
        
        return send_file(
            reconciliation.report_path,
            as_attachment=True,
            download_name=os.path.basename(reconciliation.report_path)
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/download-enriched/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def download_enriched_report(reconciliation_id):
    """
    Download enriched reconciliation report with Approval Status and Dept. Reconcile columns.
    Reads records from DB (which have approval_status), rebuilds the Excel with extra columns.
    """
    import io
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()

        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Original report not found'}), 404

        # ── Approval label map ────────────────────────────────────────────────
        APPROVAL_LABELS = {
            'pending':                    'Pending',
            'reconciled':                'Reconciled',
            'unreconciled':              'Unreconciled',
            'surplus_assets':            'Surplus Assets',
            'exist_in_physical_not_erp': 'Exist in Physical not ERP',
            'exist_in_erp_not_physical': 'Exist in ERP not Physical',
        }

        # ── Dept Reconcile helper ─────────────────────────────────────────────
        def _norm(val):
            if not val or str(val).strip() in ('', 'nan', 'None'):
                return None
            return str(val).strip().upper()

        def _dept_reconcile(c_dept, i_dept, c_dist, i_dist):
            dept_same  = bool(_norm(c_dept) and _norm(i_dept) and _norm(c_dept) == _norm(i_dept))
            dist_same  = bool(_norm(c_dist) and _norm(i_dist) and _norm(c_dist) == _norm(i_dist))
            dept_avail = bool(_norm(c_dept) and _norm(i_dept))
            dist_avail = bool(_norm(c_dist) and _norm(i_dist))
            if not dept_avail and not dist_avail:
                return 'N/A'
            if dept_avail and dist_avail:
                if dept_same and dist_same:       return 'Same'
                if dept_same and not dist_same:   return 'Same Dept, Diff District'
                if not dept_same and dist_same:   return 'Diff Dept, Same District'
                return 'Different'
            if dept_avail:
                return 'Same' if dept_same else 'Different'
            return 'Same' if dist_same else 'Different'

        # ── Build approval lookup from DB ─────────────────────────────────────
        db_records = ReconciliationRecord.query.filter_by(
            reconciliation_id=reconciliation_id
        ).all()

        # key: (match_category, row_index_in_category)
        # We'll map by sequential index per category sheet
        approval_by_category = {}   # { match_category: [rec, rec, ...] ordered by id }
        for rec in sorted(db_records, key=lambda r: r.id):
            approval_by_category.setdefault(rec.match_category, []).append(rec)

        # ── Read original Excel and add columns sheet by sheet ────────────────
        sheet_to_category = {
            'Exact_Matched_By_Tag':          'Exact Match',
            'AI_Matched_Need_Manual_Review':  'AI Match',
            'Matched_Need_Manual_Review':     'Manual Review',
            'Customer_Unmatched':            'Customer Unmatched',
            'Finance_Unmatched':             'Finance Unmatched',
            'Customer_Duplicates':           'Duplicate',
            'Finance_Duplicates':            'Duplicate',
        }

        excel_file = pd.ExcelFile(reconciliation.report_path)
        output_buf = io.BytesIO()

        with pd.ExcelWriter(output_buf, engine='openpyxl') as writer:
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)

                category = sheet_to_category.get(sheet_name)
                if category and not (len(df.columns) == 1 and 'Message' in df.columns):
                    recs = approval_by_category.get(category, [])

                    approval_col    = []
                    dept_rec_col    = []

                    for i, row in df.iterrows():
                        db_rec = recs[i] if i < len(recs) else None
                        json_data = db_rec.full_record_json or {} if db_rec else {}

                        # Approval label
                        status = db_rec.approval_status if db_rec else 'pending'
                        approval_col.append(APPROVAL_LABELS.get(status or 'pending', 'Pending'))

                        # Dept reconcile — pick fields from json or df columns
                        def _pick(keys):
                            for k in keys:
                                v = json_data.get(k) or (row.get(k) if k in df.columns else None)
                                if v and str(v).strip() not in ('', 'nan', 'None'):
                                    return str(v).strip()
                            return None

                        c_dept = _pick(['customer_department', 'department'])
                        i_dept = _pick(['internal_department'])
                        c_dist = _pick(['customer_district', 'district'])
                        i_dist = _pick(['internal_district'])

                        dept_rec_col.append(_dept_reconcile(c_dept, i_dept, c_dist, i_dist))

                    df.insert(len(df.columns), 'Approval Status', approval_col)
                    df.insert(len(df.columns), 'Dept. Reconcile',  dept_rec_col)

                df.to_excel(writer, sheet_name=sheet_name, index=False)

        output_buf.seek(0)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename  = f'reconciliation_enriched_{reconciliation_id}_{timestamp}.xlsx'

        return send_file(
            output_buf,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """
    Enriched analytics: KPIs, approval breakdown, category/branch/division/monthly trends.
    Derived from ReconciliationRecord approval_status + full_record_json fields.
    """
    try:
        from sqlalchemy import func, extract
        user_id   = int(get_jwt_identity())
        user_role = get_user_role()

        # ── scope filter ───────────────────────────────────────────────────────
        if user_role in ['manager', 'admin']:
            reconciliations = Reconciliation.query.filter_by(status='completed').all()
            recon_ids = [r.id for r in reconciliations]
            scope = 'all'
        else:
            reconciliations = Reconciliation.query.filter_by(
                user_id=user_id, status='completed').all()
            recon_ids = [r.id for r in reconciliations]
            scope = 'own'

        if not reconciliations:
            return jsonify({
                'total_reconciliations': 0,
                'total_customer_records': 0, 'total_internal_records': 0,
                'total_rule_matched': 0, 'total_ai_matched': 0,
                'total_manual_review': 0, 'average_match_rate': 0,
                'approval_kpis': {}, 'category_breakdown': [],
                'department_breakdown': [], 'district_breakdown': [],
                'monthly_trend': [], 'scope': scope, 'role': user_role
            }), 200

        # ── base job stats ─────────────────────────────────────────────────────
        total_customer    = sum(r.total_customer_records for r in reconciliations)
        total_internal    = sum(r.total_internal_records  for r in reconciliations)
        total_rule        = sum(r.rule_matched    for r in reconciliations)
        total_ai          = sum(r.ai_matched      for r in reconciliations)
        total_manual      = sum(r.manual_review   for r in reconciliations)
        total_unmatched   = sum(r.customer_unmatched for r in reconciliations)
        total_matched     = total_rule + total_ai
        avg_rate          = round(total_matched / total_customer * 100, 2) if total_customer else 0

        # ── approval KPIs from ReconciliationRecord ────────────────────────────
        STATUS_COUNTS = db.session.query(
            ReconciliationRecord.approval_status,
            func.count(ReconciliationRecord.id)
        ).filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids)
        ).group_by(ReconciliationRecord.approval_status).all()

        approval_counts = {s: 0 for s in [
            'pending','reconciled','unreconciled','surplus_assets',
            'exist_in_physical_not_erp','exist_in_erp_not_physical'
        ]}
        for status, cnt in STATUS_COUNTS:
            key = status or 'pending'
            approval_counts[key] = approval_counts.get(key, 0) + cnt

        total_records_in_db = sum(approval_counts.values())
        recon_rate = round(
            approval_counts['reconciled'] / total_records_in_db * 100, 2
        ) if total_records_in_db else 0

        approval_kpis = {
            'total_erp_assets':     total_internal,
            'physical_count':       total_customer,
            'reconciled':           approval_counts['reconciled'],
            'reconciliation_rate':  recon_rate,
            'unreconciled':         approval_counts['unreconciled'],
            'surplus_assets':       approval_counts['surplus_assets'],
            'exist_physical_not_erp': approval_counts['exist_in_physical_not_erp'],
            'exist_erp_not_physical': approval_counts['exist_in_erp_not_physical'],
            'pending':              approval_counts['pending'],
        }

        # ── helpers to extract field from json ─────────────────────────────────
        def _pick(json_data, *keys):
            for k in keys:
                v = json_data.get(k)
                if v and str(v).strip() not in ('', 'nan', 'None'):
                    return str(v).strip()
            return None

        # ── load all records for breakdown analyses ────────────────────────────
        all_records = ReconciliationRecord.query.filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids)
        ).all()

        # ── category breakdown ─────────────────────────────────────────────────
        cat_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            cat = (_pick(j, 'customer_category', 'internal_category', 'category') or
                   rec.match_category or 'Unknown')
            if cat not in cat_stats:
                cat_stats[cat] = {'total': 0, 'reconciled': 0}
            cat_stats[cat]['total'] += 1
            if rec.approval_status == 'reconciled':
                cat_stats[cat]['reconciled'] += 1

        category_breakdown = sorted([
            {
                'name':        k,
                'total':       v['total'],
                'reconciled':  v['reconciled'],
                'rate':        round(v['reconciled'] / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in cat_stats.items() if k not in ('Unknown',)
        ], key=lambda x: -x['rate'])[:15]

        # ── department breakdown ───────────────────────────────────────────────
        dept_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dept = _pick(j, 'customer_department', 'internal_department', 'department') or 'Unknown'
            if dept == 'Unknown': continue
            if dept not in dept_stats:
                dept_stats[dept] = {'total': 0, 'reconciled': 0}
            dept_stats[dept]['total'] += 1
            if rec.approval_status == 'reconciled':
                dept_stats[dept]['reconciled'] += 1

        department_breakdown = sorted([
            {
                'name':       k,
                'total':      v['total'],
                'reconciled': v['reconciled'],
                'rate':       round(v['reconciled'] / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in dept_stats.items()
        ], key=lambda x: -x['rate'])[:15]

        # ── district/branch breakdown ──────────────────────────────────────────
        dist_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dist = _pick(j, 'customer_district', 'internal_district', 'district') or 'Unknown'
            if dist == 'Unknown': continue
            if dist not in dist_stats:
                dist_stats[dist] = {'total': 0, 'reconciled': 0}
            dist_stats[dist]['total'] += 1
            if rec.approval_status == 'reconciled':
                dist_stats[dist]['reconciled'] += 1

        district_breakdown = sorted([
            {
                'name':       k,
                'total':      v['total'],
                'reconciled': v['reconciled'],
                'rate':       round(v['reconciled'] / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in dist_stats.items()
        ], key=lambda x: -x['rate'])[:15]

        # ── monthly trend (by reconciliation completion date) ──────────────────
        monthly = {}
        for r in reconciliations:
            if not r.completed_at:
                continue
            key = r.completed_at.strftime('%Y-%m')
            if key not in monthly:
                monthly[key] = {
                    'month': r.completed_at.strftime('%b %Y'),
                    'total': 0, 'matched': 0
                }
            monthly[key]['total']   += r.total_customer_records
            monthly[key]['matched'] += r.rule_matched + r.ai_matched

        monthly_trend = sorted([
            {
                'month':   v['month'],
                'total':   v['total'],
                'matched': v['matched'],
                'rate':    round(v['matched'] / v['total'] * 100, 1) if v['total'] else 0
            }
            for v in monthly.values()
        ], key=lambda x: x['month'])[-12:]

        return jsonify({
            'total_reconciliations':  len(reconciliations),
            'total_customer_records': total_customer,
            'total_internal_records': total_internal,
            'total_rule_matched':     total_rule,
            'total_ai_matched':       total_ai,
            'total_manual_review':    total_manual,
            'average_match_rate':     avg_rate,
            'approval_kpis':          approval_kpis,
            'category_breakdown':     category_breakdown,
            'department_breakdown':   department_breakdown,
            'district_breakdown':     district_breakdown,
            'monthly_trend':          monthly_trend,
            'scope': scope, 'role': user_role
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/<int:reconciliation_id>/approve', methods=['POST'])
@jwt_required()
@require_role('manager')
def approve_exception(reconciliation_id):
    """
    Approve exception for a reconciliation (Manager+ only).
    
    DEPRECATED: Use /records/approve-group endpoint instead.
    This is logged to the audit trail.
    """
    try:
        # Verify reconciliation exists
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        if reconciliation.status != 'completed':
            return jsonify({
                'error': 'Cannot approve exceptions',
                'message': 'Only completed reconciliations can have exceptions approved.'
            }), 400
        
        # Get manager user
        manager_user = get_user_from_token()
        
        # Log the approval to audit trail
        AuditService.log_operation(
            user_id=manager_user.id,
            operation_type='APPROVE_EXCEPTION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={
                'reconciliation_user_id': reconciliation.user_id,
                'total_records': reconciliation.total_customer_records
            }
        )
        
        return jsonify({
            'message': 'Exception approved successfully',
            'reconciliation_id': reconciliation_id,
            'approved_by': manager_user.username
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/records/approve-record', methods=['POST'])
@jwt_required()
@require_role('manager')
def approve_record():
    """
    Approve or reject a single record by ID (Manager/Admin only).

    Request body:
    {
        "record_id": 42,
        "approval_decision": "reconciled" | "unreconciled" | "surplus_assets" | "exist_in_physical_not_erp" | "exist_in_erp_not_physical" | "pending"
    }
    """
    VALID_DECISIONS = [
        'pending', 'reconciled', 'unreconciled',
        'surplus_assets', 'exist_in_physical_not_erp', 'exist_in_erp_not_physical'
    ]
    try:
        data = request.get_json()
        record_id = data.get('record_id')
        approval_decision = data.get('approval_decision')

        if not record_id or not approval_decision:
            return jsonify({'error': 'Missing required fields: record_id, approval_decision'}), 400

        if approval_decision not in VALID_DECISIONS:
            return jsonify({
                'error': 'Invalid approval_decision',
                'allowed': VALID_DECISIONS
            }), 400

        record = ReconciliationRecord.query.get(record_id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404

        manager_user = get_user_from_token()

        record.approval_status = approval_decision
        record.approved_by = manager_user.id
        record.approved_at = datetime.utcnow()
        db.session.commit()

        AuditService.log_operation(
            user_id=manager_user.id,
            operation_type='APPROVE_RECORD',
            resource_type='reconciliation_records',
            resource_id=record_id,
            details={
                'approval_decision': approval_decision,
                'reconciliation_id': record.reconciliation_id,
                'match_category': record.match_category
            }
        )

        return jsonify({
            'message': f'Record {record_id} marked as {approval_decision}',
            'record_id': record_id,
            'approval_status': approval_decision,
            'approved_by': manager_user.username
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/records/approve-group', methods=['POST'])
@jwt_required()
@require_role('manager')
def approve_group():
    """
    Approve a group of records by category (Manager+ only).
    This also saves records to database if not already saved.
    
    Request body:
    {
        "reconciliation_id": 123,
        "category": "Exact Match",
        "approval_decision": "reconciled" or "not_reconciled"
    }
    """
    try:
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        category = data.get('category')
        approval_decision = data.get('approval_decision')
        
        # Validation
        if not all([reconciliation_id, category, approval_decision]):
            return jsonify({
                'error': 'Missing required fields',
                'required': ['reconciliation_id', 'category', 'approval_decision']
            }), 400
        
        VALID_DECISIONS = [
            'reconciled', 'unreconciled', 'surplus_assets',
            'exist_in_physical_not_erp', 'exist_in_erp_not_physical'
        ]
        if approval_decision not in VALID_DECISIONS:
            return jsonify({
                'error': 'Invalid approval_decision',
                'allowed': VALID_DECISIONS
            }), 400
        
        # Verify reconciliation exists
        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Report file not found'}), 404
        
        # Get manager user
        manager_user = get_user_from_token()
        
        # Check if records already exist in database for this reconciliation
        existing_count = ReconciliationRecord.query.filter_by(
            reconciliation_id=reconciliation_id
        ).count()
        
        records_created = 0
        
        # If no records exist, parse from Excel and save
        if existing_count == 0:
            print(f"No records in DB, parsing from Excel file...")
            excel_file = pd.ExcelFile(reconciliation.report_path)
            sheet_mapping = {
                'Exact_Matched_By_Tag': 'Exact Match',
                'AI_Matched_Need_Manual_Review': 'AI Match',
                'Matched_Need_Manual_Review': 'Manual Review',
                'Customer_Unmatched': 'Customer Unmatched',
                'Finance_Unmatched': 'Finance Unmatched',
                'Customer_Duplicates': 'Duplicate',
                'Finance_Duplicates': 'Duplicate'
            }
            
            for sheet_name, match_type in sheet_mapping.items():
                if sheet_name in excel_file.sheet_names:
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    
                    if 'Message' in df.columns and len(df.columns) == 1:
                        continue
                    
                    for _, row in df.iterrows():
                        row_dict = row.to_dict()
                        cleaned_dict = {}
                        for col, val in row_dict.items():
                            if pd.isna(val):
                                cleaned_dict[col] = None
                            else:
                                cleaned_dict[col] = val
                        
                        record = ReconciliationRecord(
                            reconciliation_id=reconciliation_id,
                            match_category=match_type,
                            full_record_json=cleaned_dict,
                            approval_status='pending'
                        )
                        db.session.add(record)
                        records_created += 1
            
            db.session.flush()
            print(f"Created {records_created} records in database")
        
        # Now update the specific category with approval
        if category == 'Unmatched':
            records = ReconciliationRecord.query.filter(
                ReconciliationRecord.reconciliation_id == reconciliation_id,
                db.or_(
                    ReconciliationRecord.match_category == 'Customer Unmatched',
                    ReconciliationRecord.match_category == 'Finance Unmatched'
                )
            ).all()
        else:
            records = ReconciliationRecord.query.filter_by(
                reconciliation_id=reconciliation_id,
                match_category=category
            ).all()
        
        if not records:
            return jsonify({
                'error': 'No records found',
                'message': f'No records found for category: {category}'
            }), 404
        
        # Update all records in the group
        updated_count = 0
        for record in records:
            record.approval_status = approval_decision
            record.approved_by = manager_user.id
            record.approved_at = datetime.utcnow()
            updated_count += 1
        
        db.session.commit()
        
        # Log to audit trail
        AuditService.log_operation(
            user_id=manager_user.id,
            operation_type='APPROVE_RECORD_GROUP',
            resource_type='reconciliation_records',
            resource_id=reconciliation_id,
            details={
                'category': category,
                'approval_decision': approval_decision,
                'records_count': updated_count,
                'records_created': records_created,
                'reconciliation_user_id': reconciliation.user_id
            }
        )
        
        message = f'Successfully approved {updated_count} records'
        if records_created > 0:
            message += f' and saved {records_created} total records to database'
        
        return jsonify({
            'message': message,
            'category': category,
            'approval_decision': approval_decision,
            'records_updated': updated_count,
            'records_created': records_created,
            'approved_by': manager_user.username
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/records/approval-summary/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_approval_summary(reconciliation_id):
    """
    Get approval summary for a reconciliation showing counts by category and status.
    """
    try:
        # Verify reconciliation exists
        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Get counts by category and approval status
        from sqlalchemy import func
        
        results = db.session.query(
            ReconciliationRecord.match_category,
            ReconciliationRecord.approval_status,
            func.count(ReconciliationRecord.id).label('count')
        ).filter(
            ReconciliationRecord.reconciliation_id == reconciliation_id
        ).group_by(
            ReconciliationRecord.match_category,
            ReconciliationRecord.approval_status
        ).all()
        
        # Organize data by category
        summary = {}
        for match_category, approval_status, count in results:
            if match_category not in summary:
                summary[match_category] = {
                    'total': 0,
                    'pending': 0,
                    'reconciled': 0,
                    'unreconciled': 0,
                    'not_reconciled': 0,  # legacy alias
                    'surplus_assets': 0,
                    'exist_in_physical_not_erp': 0,
                    'exist_in_erp_not_physical': 0,
                }
            summary[match_category]['total'] += count
            key = approval_status or 'pending'
            if key in summary[match_category]:
                summary[match_category][key] += count
            else:
                summary[match_category][key] = count
        
        # Group unmatched categories
        if 'Customer Unmatched' in summary or 'Finance Unmatched' in summary:
            unmatched_summary = {
                'total': 0, 'pending': 0, 'reconciled': 0,
                'unreconciled': 0, 'not_reconciled': 0,
                'surplus_assets': 0,
                'exist_in_physical_not_erp': 0,
                'exist_in_erp_not_physical': 0,
            }
            for key in ['Customer Unmatched', 'Finance Unmatched']:
                if key in summary:
                    for field in unmatched_summary:
                        unmatched_summary[field] += summary[key].get(field, 0)
            summary['Unmatched'] = unmatched_summary
        
        return jsonify({
            'reconciliation_id': reconciliation_id,
            'summary': summary
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/<int:reconciliation_id>/finalize', methods=['POST'])
@jwt_required()
@require_role('manager')
def finalize_reconciliation(reconciliation_id):
    """
    Finalize a reconciliation (Manager+ only).
    
    Managers can mark reconciliations as finalized.
    This is logged to the audit trail.
    """
    try:
        # Verify reconciliation exists
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        if reconciliation.status != 'completed':
            return jsonify({
                'error': 'Cannot finalize',
                'message': 'Only completed reconciliations can be finalized.'
            }), 400
        
        # Get manager user
        manager_user = get_user_from_token()
        
        # Log finalization to audit trail
        AuditService.log_operation(
            user_id=manager_user.id,
            operation_type='FINALIZE_RECONCILIATION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={
                'reconciliation_user_id': reconciliation.user_id,
                'total_records': reconciliation.total_customer_records,
                'match_statistics': {
                    'rule_matched': reconciliation.rule_matched,
                    'ai_matched': reconciliation.ai_matched,
                    'manual_review': reconciliation.manual_review
                }
            }
        )
        
        return jsonify({
            'message': 'Reconciliation finalized successfully',
            'reconciliation_id': reconciliation_id,
            'finalized_by': manager_user.username
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/records-from-file/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_records_from_file(reconciliation_id):
    """Get records directly from Excel file without database storage"""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        
        # Get reconciliation and check access
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own reconciliation records.'
            }), 403
        
        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Report file not found'}), 404
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        category = request.args.get('category', 'all', type=str)
        
        # Parse Excel file
        excel_file = pd.ExcelFile(reconciliation.report_path)
        sheet_mapping = {
            'Exact_Matched_By_Tag': 'Exact Match',
            'AI_Matched_Need_Manual_Review': 'AI Match',
            'Matched_Need_Manual_Review': 'Manual Review',
            'Customer_Unmatched': 'Customer Unmatched',
            'Finance_Unmatched': 'Finance Unmatched',
        }
        
        all_records = []
        
        for sheet_name, match_type in sheet_mapping.items():
            # Skip if filtering by category and this isn't the category
            if category != 'all':
                if category == 'Unmatched' and match_type not in ['Customer Unmatched', 'Finance Unmatched']:
                    continue
                elif category != 'Unmatched' and category != match_type:
                    continue
            
            if sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                
                # Check if this sheet is empty
                if 'Message' in df.columns and len(df.columns) == 1:
                    continue
                
                for idx, row in df.iterrows():
                    row_dict = row.to_dict()
                    
                    # Extract key fields
                    customer_tag = row_dict.get('New Tag') or row_dict.get('Old Tag') or '-'
                    internal_tag = '-'
                    description = row_dict.get('Description', '-')
                    match_method = match_type
                    confidence = '-'
                    
                    # Try to extract internal tag if available
                    for key in row_dict.keys():
                        if 'Internal' in str(key) and 'Tag' in str(key):
                            internal_tag = row_dict[key] if pd.notna(row_dict[key]) else '-'
                            break
                    
                    all_records.append({
                        'id': f"{sheet_name}_{idx}",
                        'category': match_type,
                        'customer_tag': customer_tag if pd.notna(customer_tag) else '-',
                        'internal_tag': internal_tag,
                        'description': description if pd.notna(description) else '-',
                        'match_method': match_method,
                        'confidence': confidence,
                        'status': 'Matched' if match_type in ['Exact Match', 'AI Match'] else 
                                 'Review Required' if match_type == 'Manual Review' else 'Unmatched',
                        'approval_status': 'pending',
                        'approved_by': None,
                        'approved_at': None
                    })
        
        # Pagination
        total_records = len(all_records)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_records = all_records[start_idx:end_idx]
        
        return jsonify({
            'records': paginated_records,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_records': total_records,
                'total_pages': (total_records + per_page - 1) // per_page,
                'has_next': end_idx < total_records,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/records/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_records(reconciliation_id):
    """Get paginated records from database for a specific reconciliation"""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        
        # Get reconciliation and check access
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own reconciliation records.'
            }), 403
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        category = request.args.get('category', 'all', type=str)
        approval_status_filter = request.args.get('approval_status', 'all', type=str)
        
        print(f"\n=== DEBUG GET_RECORDS ===")
        print(f"Reconciliation ID: {reconciliation_id}")
        print(f"Category filter: '{category}'")
        print(f"Approval status filter: '{approval_status_filter}'")
        print(f"Page: {page}, Per page: {per_page}")
        
        # Build query
        query = ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation_id)
        
        # Get all unique categories first (for debugging)
        all_categories = db.session.query(ReconciliationRecord.match_category).filter_by(
            reconciliation_id=reconciliation_id
        ).distinct().all()
        print(f"Available categories in DB: {[c[0] for c in all_categories]}")
        
        # Filter by category if specified
        if category != 'all':
            if category == 'Unmatched':
                # Handle both Customer and Finance unmatched
                query = query.filter(
                    db.or_(
                        ReconciliationRecord.match_category == 'Customer Unmatched',
                        ReconciliationRecord.match_category == 'Finance Unmatched'
                    )
                )
                print(f"Filtering for: Customer Unmatched OR Finance Unmatched")
            else:
                query = query.filter_by(match_category=category)
                print(f"Filtering for exact match: '{category}'")

        # Filter by approval status if specified
        if approval_status_filter != 'all':
            query = query.filter_by(approval_status=approval_status_filter)
            print(f"Filtering by approval_status: '{approval_status_filter}'")
        
        # Count before pagination
        total_count = query.count()
        print(f"Total records matching filter: {total_count}")
        
        # Get paginated results
        pagination = query.order_by(ReconciliationRecord.id).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        print(f"Returning {len(pagination.items)} records")
        
        records = []
        for record in pagination.items:
            # Extract relevant fields from full_record_json
            json_data = record.full_record_json or {}
            
            # Get approver info if approved (handle None gracefully)
            approver_name = None
            try:
                if hasattr(record, 'approved_by') and record.approved_by:
                    approver = db.session.query(User.username).filter_by(id=record.approved_by).first()
                    if approver:
                        approver_name = approver[0]
            except Exception as e:
                print(f"Warning: Could not fetch approver name: {e}")
            
            # Get approval status (default to 'pending' if column doesn't exist yet)
            approval_status = getattr(record, 'approval_status', 'pending') or 'pending'
            approved_at = getattr(record, 'approved_at', None)

            # ── smart field extraction from full_record_json ──────────────────
            # Matched sheets:  customer_* / internal_* prefixed keys
            # Unmatched sheets: raw keys (old_tag_number, new_tag_number, description …)
            def _v(keys):
                """First non-empty value among candidate keys."""
                for k in keys:
                    v = json_data.get(k)
                    if v is not None and str(v).strip() not in ('', 'nan', 'None'):
                        return str(v).strip()
                return None

            is_unmatched = record.match_category in ('Customer Unmatched', 'Finance Unmatched')
            is_internal_unmatched = record.match_category == 'Finance Unmatched'

            # ── customer side ──────────────────────────────────────────────────
            if is_unmatched and is_internal_unmatched:
                # Finance Unmatched: raw cols are the internal side
                c_old_tag    = None
                c_new_tag    = None
                c_year       = None
                c_category   = None
                c_desc       = None
                c_serial     = None
                c_department = None
                c_district   = None
                c_book_value = None
                c_asset_no   = None
            else:
                c_old_tag    = _v(['customer_old_tag', 'old_tag_number'])
                c_new_tag    = _v(['customer_new_tag', 'new_tag_number'])
                c_year       = _v(['customer_year', 'year'])
                c_category   = _v(['customer_category', 'category'])
                c_desc       = _v(['customer_description', 'description'])
                c_serial     = _v(['customer_serial_no', 'serial_no'])
                c_department = _v(['customer_department', 'department'])
                c_district   = _v(['customer_district', 'district'])
                c_book_value = _v(['customer_book_value', 'book_value'])
                c_asset_no   = _v(['customer_asset_number', 'asset_number'])

            # ── internal side ──────────────────────────────────────────────────
            if is_unmatched and not is_internal_unmatched:
                # Customer Unmatched: no internal side
                i_old_tag    = None
                i_new_tag    = None
                i_year       = None
                i_category   = None
                i_desc       = None
                i_serial     = None
                i_department = None
                i_district   = None
                i_book_value = None
                i_asset_no   = None
            elif is_unmatched and is_internal_unmatched:
                # Finance Unmatched: raw cols ARE the internal side
                i_old_tag    = _v(['old_tag_number', 'internal_old_tag'])
                i_new_tag    = _v(['new_tag_number', 'internal_new_tag'])
                i_year       = _v(['year', 'internal_year'])
                i_category   = _v(['category', 'internal_category'])
                i_desc       = _v(['description', 'internal_description'])
                i_serial     = _v(['serial_no', 'internal_serial_no'])
                i_department = _v(['department', 'internal_department'])
                i_district   = _v(['district', 'internal_district'])
                i_book_value = _v(['book_value', 'internal_book_value'])
                i_asset_no   = _v(['asset_number', 'internal_asset_number'])
            else:
                # Matched sheets: both sides prefixed
                i_old_tag    = _v(['internal_old_tag'])
                i_new_tag    = _v(['internal_new_tag'])
                i_year       = _v(['internal_year'])
                i_category   = _v(['internal_category'])
                i_desc       = _v(['internal_description'])
                i_serial     = _v(['internal_serial_no'])
                i_department = _v(['internal_department'])
                i_district   = _v(['internal_district'])
                i_book_value = _v(['internal_book_value'])
                i_asset_no   = _v(['internal_asset_number'])

            # ── match metadata ─────────────────────────────────────────────────
            match_method = _v(['match_method', 'match_type']) or record.match_category
            confidence_val = record.confidence_score or json_data.get('confidence_score')
            try:
                confidence_str = f"{float(confidence_val):.0%}" if confidence_val else '—'
            except (ValueError, TypeError):
                confidence_str = str(confidence_val) if confidence_val else '—'

            # ── department + district reconciliation flag ──────────────────────
            def _normalize(val):
                if not val or str(val).strip() in ('', '—', 'nan', 'None'):
                    return None
                return str(val).strip().upper()

            c_dept_norm = _normalize(c_department)
            i_dept_norm = _normalize(i_department)
            c_dist_norm = _normalize(c_district)
            i_dist_norm = _normalize(i_district)

            dept_same = (c_dept_norm and i_dept_norm and c_dept_norm == i_dept_norm)
            dist_same = (c_dist_norm and i_dist_norm and c_dist_norm == i_dist_norm)
            dept_avail = bool(c_dept_norm and i_dept_norm)
            dist_avail = bool(c_dist_norm and i_dist_norm)

            if not dept_avail and not dist_avail:
                dept_reconcile = 'N/A'
            elif dept_avail and dist_avail:
                if dept_same and dist_same:
                    dept_reconcile = 'Same'
                elif dept_same and not dist_same:
                    dept_reconcile = 'Same Dept, Diff District'
                elif not dept_same and dist_same:
                    dept_reconcile = 'Diff Dept, Same District'
                else:
                    dept_reconcile = 'Different'
            elif dept_avail:
                dept_reconcile = 'Same' if dept_same else 'Different'
            else:
                dept_reconcile = 'Same' if dist_same else 'Different'

            records.append({
                'id': record.id,
                'category': record.match_category,
                # Customer columns
                'customer_old_tag':    c_old_tag    or '—',
                'customer_new_tag':    c_new_tag    or '—',
                'customer_year':       c_year       or '—',
                'customer_category':   c_category   or '—',
                'customer_description':c_desc       or '—',
                'customer_serial':     c_serial     or '—',
                'customer_department': c_department or '—',
                'customer_district':   c_district   or '—',
                'customer_book_value': c_book_value or '—',
                'customer_asset_no':   c_asset_no   or '—',
                # Internal columns
                'internal_old_tag':    i_old_tag    or '—',
                'internal_new_tag':    i_new_tag    or '—',
                'internal_year':       i_year       or '—',
                'internal_category':   i_category   or '—',
                'internal_description':i_desc       or '—',
                'internal_serial':     i_serial     or '—',
                'internal_department': i_department or '—',
                'internal_district':   i_district   or '—',
                'internal_book_value': i_book_value or '—',
                'internal_asset_no':   i_asset_no   or '—',
                # Dept reconcile flag
                'dept_reconcile': dept_reconcile,
                # Match metadata
                'match_method':  match_method,
                'confidence':    confidence_str,
                'status': (
                    'Matched'         if record.match_category in ['Exact Match', 'AI Match'] else
                    'Review Required' if record.match_category == 'Manual Review' else
                    'Unmatched'
                ),
                'approval_status': approval_status,
                'approved_by':     approver_name,
                'approved_at':     approved_at.isoformat() if approved_at else None,
                'full_data':       json_data
            })
        
        print(f"=== END DEBUG ===\n")
        
        return jsonify({
            'records': records,
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total_records': pagination.total,
                'total_pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/record/<int:reconciliation_id>', methods=['POST'])
@jwt_required()
def record_results(reconciliation_id):
    """Parse the Excel report and save records to the database"""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        
        # Get reconciliation and check access
        reconciliation = Reconciliation.query.get(reconciliation_id)
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only record your own reconciliation results.'
            }), 403
            
        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Report not found or not yet generated'}), 404
            
        # Delete existing records for this reconciliation to handle re-recording (upsert)
        ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation_id).delete()
        db.session.flush() # Flush instead of commit so we can do it all in one transaction
        
        # Parse Excel file
        excel_file = pd.ExcelFile(reconciliation.report_path)
        sheet_mapping = {
            'Exact_Matched_By_Tag': 'Exact Match',
            'AI_Matched_Need_Manual_Review': 'AI Match',
            'Matched_Need_Manual_Review': 'Manual Review',
            'Customer_Unmatched': 'Customer Unmatched',
            'Finance_Unmatched': 'Finance Unmatched',
            'Customer_Duplicates': 'Duplicate',
            'Finance_Duplicates': 'Duplicate'
        }
        
        parsed_records_kwargs = []
        all_tags = set()
        
        for sheet_name, match_type in sheet_mapping.items():
            if sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                
                # Check if this sheet is empty (contains 'Message' column)
                if 'Message' in df.columns and len(df.columns) == 1:
                    continue
                
                for _, row in df.iterrows():
                    row_dict = row.to_dict()
                    
                    # Clean NaNs for DB insertion and JSON serialization
                    cleaned_dict = {}
                    for col, val in row_dict.items():
                        if pd.isna(val):
                            cleaned_dict[col] = None
                        else:
                            cleaned_dict[col] = val
                            
                    record_kwargs = {
                        'reconciliation_id': reconciliation_id,
                        'match_category': match_type,
                        'full_record_json': cleaned_dict
                    }
                    
                    # Map standard physical columns dynamically
                    for col, val in cleaned_dict.items():
                        # Direct match (e.g., 'customer_description', 'match_type')
                        if hasattr(ReconciliationRecord, col) and col not in ['id', 'reconciliation_id', 'created_at', 'match_category', 'full_record_json']:
                            record_kwargs[col] = val
                        # Attempt to map unprefixed columns (e.g., 'description' in an Unmatched sheet)
                        elif not col.startswith('customer_') and not col.startswith('internal_'):
                            if 'Customer' in sheet_name or 'customer' in sheet_name.lower():
                                mapped_col = f"customer_{col}"
                                if hasattr(ReconciliationRecord, mapped_col):
                                    record_kwargs[mapped_col] = val
                            elif 'Finance' in sheet_name or 'internal' in sheet_name.lower():
                                mapped_col = f"internal_{col}"
                                if hasattr(ReconciliationRecord, mapped_col):
                                    record_kwargs[mapped_col] = val
                    
                    # Identify unique tag
                    tag = record_kwargs.get('internal_new_tag')
                    if not tag:
                        tag = record_kwargs.get('customer_new_tag')
                        
                    if tag:
                        all_tags.add(tag)
                        
                    parsed_records_kwargs.append((tag, record_kwargs))

        # Query existing records that match these tags
        existing_records_by_tag = {}
        if all_tags:
            existing_records = ReconciliationRecord.query.filter(
                db.or_(
                    ReconciliationRecord.internal_new_tag.in_(list(all_tags)),
                    ReconciliationRecord.customer_new_tag.in_(list(all_tags))
                )
            ).all()
            
            for rec in existing_records:
                if rec.internal_new_tag:
                    existing_records_by_tag[rec.internal_new_tag] = rec
                if rec.customer_new_tag and rec.customer_new_tag not in existing_records_by_tag:
                    existing_records_by_tag[rec.customer_new_tag] = rec
                    
        records_to_insert = []
        records_to_update = 0
                    
        # Apply upsert logic
        for tag, kwargs in parsed_records_kwargs:
            if tag and tag in existing_records_by_tag:
                # Update existing
                existing_record = existing_records_by_tag[tag]
                for k, v in kwargs.items():
                    setattr(existing_record, k, v)
                records_to_update += 1
            else:
                # Insert new
                new_record = ReconciliationRecord(**kwargs)
                records_to_insert.append(new_record)
                if tag:
                    # Add to dictionary so any intra-file duplicates update this instead of inserting again
                    existing_records_by_tag[tag] = new_record
        
        if records_to_insert:
            db.session.bulk_save_objects(records_to_insert)
            
        db.session.commit()
            
        return jsonify({
            'message': f'Successfully recorded {len(records_to_insert) + records_to_update} results to database ({records_to_update} updated, {len(records_to_insert)} newly inserted)',
            'count': len(records_to_insert) + records_to_update
        }), 201
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



@reconciliation_bp.route('/records/debug-keys/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def debug_record_keys(reconciliation_id):
    """
    Debug: returns the JSON keys from the first record of each category.
    Helps diagnose column name mapping issues.
    """
    try:
        from sqlalchemy import func
        categories = db.session.query(ReconciliationRecord.match_category).filter_by(
            reconciliation_id=reconciliation_id
        ).distinct().all()

        result = {}
        for (cat,) in categories:
            rec = ReconciliationRecord.query.filter_by(
                reconciliation_id=reconciliation_id,
                match_category=cat
            ).first()
            if rec and rec.full_record_json:
                result[cat] = list(rec.full_record_json.keys())
            else:
                result[cat] = []

        return jsonify({'reconciliation_id': reconciliation_id, 'keys_by_category': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
