from flask import Blueprint, current_app, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from io import BytesIO
import pandas as pd
import json

from models import db, Reconciliation, ReconciliationRecord, User
from services.reconciliation_service import ReconciliationService
from services.audit_service import AuditService
from utils.rbac import require_role, get_user_from_token, get_user_role


def _user_can_access_reconciliation(reconciliation, user_id, user_role):
    """Return whether a user can view or act on a reconciliation."""
    if not reconciliation or reconciliation.is_deleted:
        return False
    if user_role in ['manager', 'admin']:
        return True
    if user_role != 'officer':
        return False
    if reconciliation.user_id == user_id:
        return True
    if reconciliation.assigned_to == user_id:
        return True
    if reconciliation.assignment_scope == 'all_officers':
        return True
    return False


def _user_can_approve_reconciliation(reconciliation, user_id, user_role):
    """Allow manager/admin or delegated officers to review approval records."""
    if user_role in ['manager', 'admin']:
        return True
    if user_role != 'officer':
        return False
    if reconciliation.user_id == user_id:
        return True
    if reconciliation.assigned_to == user_id:
        return True
    if reconciliation.assignment_scope == 'all_officers':
        return True
    return False
from config import Config
from utils.data_cleaner import DataCleaner

reconciliation_bp = Blueprint('reconciliation', __name__, url_prefix='/api/reconciliation')

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def _missing_required_columns(file_storage):
    """Read only the header row so invalid uploads are rejected before saving."""
    filename = file_storage.filename.lower()
    file_bytes = file_storage.read()
    file_storage.stream.seek(0)
    if not file_bytes:
        raise ValueError('The uploaded file is empty')

    if filename.endswith('.csv'):
        columns = pd.read_csv(BytesIO(file_bytes), nrows=0).columns
    else:
        columns = pd.read_excel(BytesIO(file_bytes), nrows=0).columns
    return DataCleaner.validate_columns(columns)


def _auto_save_records(reconciliation_id, report_path):
    """
    Parse the Excel report and save all records to DB with approval_status='pending'.
    Clears existing records for this reconciliation first (idempotent).
    """
    if not report_path or not os.path.exists(report_path):
        print(f"_auto_save_records: report not found at {report_path}")
        return 0

    reconciliation = Reconciliation.query.get(reconciliation_id)
    if not reconciliation:
        print(f"_auto_save_records: reconciliation {reconciliation_id} not found")
        return 0

    # Delete existing records (re-run safe)
    ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation_id).delete()
    db.session.flush()

    sheet_mapping = {
        'Exact_Matched_By_Tag': 'Exact Match',
        'AI_Matched_Need_Manual_Review': 'AI Match',
        'Matched_Need_Manual_Review': 'Manual Review',
        'Physical_Unmatched': 'Physical Unmatched',
        'ERP_Unmatched': 'ERP Unmatched',
        'Physical_Duplicates': 'Duplicate',
        'ERP_Duplicates': 'Duplicate'
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
            default_approval = 'duplicated' if match_type == 'Duplicate' else 'pending'

            record = ReconciliationRecord(
                reconciliation_id=reconciliation_id,
                match_category=match_type,
                maker_user_id=reconciliation.user_id,
                full_record_json=cleaned,
                check_status='pending',
                checker_status='pending',
                approval_status=default_approval,
                approver_status='pending'
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
            return jsonify({'error': 'Only Excel or CSV files (.xlsx, .xls, .csv) are allowed'}), 400

        validation_errors = []
        for file_storage, label in (
            (internal_file, 'ERP Asset Register'),
            (customer_file, 'Physical Inventory Count'),
        ):
            try:
                missing_columns = _missing_required_columns(file_storage)
            except Exception as error:
                app_logger = current_app.logger
                app_logger.exception('Failed to inspect uploaded %s file: %s', label, error)
                validation_errors.append(
                    f'{label} file could not be read. Please upload a valid Excel or CSV file.'
                )
                continue
            if missing_columns:
                validation_errors.append(
                    f"{label} file is missing required column(s): {', '.join(missing_columns)}"
                )

        if validation_errors:
            return jsonify({
                'error': ' | '.join(validation_errors),
                'validation_errors': validation_errors,
            }), 400
        
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
        
        # Audit: files uploaded
        AuditService.log_operation(
            user_id=user_id,
            operation_type='UPLOAD_FILES',
            resource_type='reconciliation',
            resource_id=reconciliation.id,
            details={
                'customer_file': customer_filename,
                'internal_file': internal_filename
            }
        )

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
            user_id=user_id,
            is_deleted=False
        ).first()
        
        if not reconciliation or reconciliation.is_deleted:
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

        # Audit: reconciliation processed
        AuditService.log_operation(
            user_id=user_id,
            operation_type='PROCESS_RECONCILIATION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={
                'total_customer_records': statistics.get('total_customer_records', 0),
                'total_internal_records': statistics.get('total_internal_records', 0),
                'rule_matched':  statistics.get('rule_matched', 0),
                'ai_matched':    statistics.get('ai_matched', 0),
                'manual_review': statistics.get('manual_review', 0),
                'customer_unmatched': statistics.get('customer_unmatched', 0),
            }
        )
        
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

@reconciliation_bp.route('/assignable-users', methods=['GET'])
@jwt_required()
@require_role('officer')
def list_assignable_users():
    """Return active officer users available for delegated check assignments."""
    try:
        user_id = int(get_jwt_identity())
        users = User.query.filter(
            User.is_active.is_(True),
            User.role == 'officer',
            User.id != user_id
        ).order_by(User.username.asc()).all()
        return jsonify({
            'users': [{
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'email': user.email,
                'role': user.role,
                'department': user.department,
            } for user in users],
            'total': len(users)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/<int:reconciliation_id>/assign', methods=['POST'])
@jwt_required()
@require_role('officer')
def assign_reconciliation(reconciliation_id):
    """Assign a report to another officer or make it visible to all officers."""
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()
        data = request.get_json(silent=True) or {}

        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if user_role == 'officer' and reconciliation.user_id != user_id:
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only assign your own reconciliation jobs.'
            }), 403

        assignment_scope = (data.get('assignment_scope') or 'all_officers').strip()
        if assignment_scope not in ['all_officers', 'specific_user']:
            return jsonify({'error': 'Invalid assignment_scope. Must be all_officers or specific_user'}), 400

        assignee_id = data.get('assignee_id')
        if assignment_scope == 'specific_user':
            if assignee_id in [None, '', 'null']:
                return jsonify({'error': 'assignee_id is required for specific_user assignments'}), 400
            try:
                assignee_id = int(assignee_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'assignee_id must be a valid user id'}), 400

            if assignee_id == reconciliation.user_id:
                return jsonify({'error': 'The maker cannot be assigned as checker for their own reconciliation.'}), 400
            if user_role == 'officer' and assignee_id == user_id:
                return jsonify({'error': 'You cannot assign a reconciliation back to yourself. Choose another officer.'}), 400
            assignee = User.query.get(assignee_id)
            if not assignee or not assignee.is_active or assignee.role != 'officer':
                return jsonify({'error': 'Selected assignee must be an active officer.'}), 404
            reconciliation.assigned_to = assignee.id
            reconciliation.assignment_scope = 'specific_user'
            ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation.id).update({
                'check_status': 'checking',
                'checked_by': assignee.id,
                'checked_at': datetime.utcnow()
            })
        else:
            reconciliation.assigned_to = None
            reconciliation.assignment_scope = 'all_officers'
            ReconciliationRecord.query.filter_by(reconciliation_id=reconciliation.id).update({
                'check_status': 'pending',
                'checked_by': None,
                'checked_at': None
            })

        reconciliation.assigned_by = user_id
        reconciliation.assignment_note = data.get('assignment_note') or reconciliation.assignment_note
        reconciliation.assigned_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Reconciliation assignment updated successfully',
            'assignment': {
                'reconciliation_id': reconciliation.id,
                'assignment_scope': reconciliation.assignment_scope,
                'assigned_to': reconciliation.assigned_to,
                'assigned_by': reconciliation.assigned_by,
                'assignment_note': reconciliation.assignment_note,
                'assigned_at': reconciliation.assigned_at.isoformat() if reconciliation.assigned_at else None,
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/list', methods=['GET'])
@jwt_required()
def list_reconciliations():
    """
    List reconciliations based on user role.

    Officers: See their own reconciliations and any delegated assignments.
    Managers/Admins: See all reconciliations system-wide.
    """
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()

        if user_role in ['manager', 'admin']:
            reconciliations = Reconciliation.query.filter_by(is_deleted=False)\
                .order_by(Reconciliation.created_at.desc()).all()
            scope = 'all'
        else:
            reconciliations = Reconciliation.query.filter_by(is_deleted=False)\
                .filter(
                    db.or_(
                        Reconciliation.user_id == user_id,
                        Reconciliation.assigned_to == user_id,
                        Reconciliation.assignment_scope == 'all_officers'
                    )
                )\
                .order_by(Reconciliation.created_at.desc()).all()
            scope = 'assigned_or_own'

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

    Officers can view their own reconciliations or delegated ones.
    Managers/Admins: Can view any reconciliation.
    """
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()

        reconciliation = Reconciliation.query.get(reconciliation_id)

        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own or assigned reconciliations.'
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

    Officers can download their own reports and delegated review assignments.
    Managers/Admins: Can download any report.
    """
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()

        reconciliation = Reconciliation.query.get(reconciliation_id)

        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only download your own or assigned reports.'
            }), 403

        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Report not found'}), 404
        
        # Audit: report downloaded
        AuditService.log_operation(
            user_id=user_id,
            operation_type='DOWNLOAD_REPORT',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={'report_path': os.path.basename(reconciliation.report_path)}
        )

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
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({'error': 'Access denied'}), 403

        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Original report not found'}), 404

        # ── Approval label map ────────────────────────────────────────────────
        APPROVAL_LABELS = {
            'reconciled':                'Reconciled',
            'unreconciled':              'Unreconciled',
            'surplus_assets':            'Surplus Assets',
            'exist_in_erp_not_physical': 'Shortage Assets',
        }

        def _status_value(record, legacy_field, explicit_field):
            if record is None:
                return None
            return getattr(record, explicit_field, None) or getattr(record, legacy_field, None) or None

        def _status_label(status):
            if status in (None, '', 'pending', 'Pending'):
                return ''
            return APPROVAL_LABELS.get(status, status)

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
            'Physical_Unmatched':            'Physical Unmatched',
            'ERP_Unmatched':                 'ERP Unmatched',
            'Physical_Duplicates':           'Duplicate',
            'ERP_Duplicates':                'Duplicate',
        }

        excel_file = pd.ExcelFile(reconciliation.report_path)
        output_buf = io.BytesIO()

        with pd.ExcelWriter(output_buf, engine='openpyxl') as writer:
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)

                category = sheet_to_category.get(sheet_name)
                if category and not (len(df.columns) == 1 and 'Message' in df.columns):
                    recs = approval_by_category.get(category, [])

                    approval_col      = []
                    checker_status_col= []
                    approver_status_col = []
                    maker_col         = []
                    checker_col       = []
                    approver_col      = []
                    dept_rec_col      = []

                    for i, row in df.iterrows():
                        db_rec = recs[i] if i < len(recs) else None
                        json_data = db_rec.full_record_json or {} if db_rec else {}

                        maker_user = db_rec.maker or (db_rec.reconciliation.user if db_rec and db_rec.reconciliation else None) if db_rec else None
                        checker_user = db_rec.checker if db_rec else None
                        approver_user = db_rec.approver if db_rec else None

                        maker_name = maker_user.username if maker_user else ''
                        checker_name = checker_user.username if checker_user else ''
                        approver_name = approver_user.username if approver_user else ''

                        # Status labels
                        checker_status = _status_value(db_rec, 'check_status', 'checker_status')
                        approver_status = _status_value(db_rec, 'approval_status', 'approver_status')
                        approval_col.append(_status_label(approver_status))
                        checker_status_col.append(_status_label(checker_status))
                        approver_status_col.append(_status_label(approver_status))
                        maker_col.append(maker_name)
                        checker_col.append(checker_name)
                        approver_col.append(approver_name)

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

                    df.insert(len(df.columns), 'Maker', maker_col)
                    df.insert(len(df.columns), 'Checker', checker_col)
                    df.insert(len(df.columns), 'Checker Status', checker_status_col)
                    df.insert(len(df.columns), 'Approver', approver_col)
                    df.insert(len(df.columns), 'Approver Status', approver_status_col)
                    df.insert(len(df.columns), 'Approval Status', approval_col)
                    df.insert(len(df.columns), 'Dept. Reconcile',  dept_rec_col)

                df.to_excel(writer, sheet_name=sheet_name, index=False)

        output_buf.seek(0)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename  = f'reconciliation_enriched_{reconciliation_id}_{timestamp}.xlsx'

        # Audit: enriched report downloaded
        AuditService.log_operation(
            user_id=user_id,
            operation_type='DOWNLOAD_ENRICHED_REPORT',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={'filename': filename}
        )

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
        period = request.args.get('period', 'all').lower()
        now = datetime.utcnow()
        # ── scope filter ───────────────────────────────────────────────────────
        if user_role in ['manager', 'admin']:
            reconciliations = Reconciliation.query.filter_by(status='completed', is_deleted=False).all()
            recon_ids = [r.id for r in reconciliations]
            scope = 'all'
        else:
            reconciliations = Reconciliation.query.filter_by(
                user_id=user_id, status='completed', is_deleted=False).all()
            recon_ids = [r.id for r in reconciliations]
            scope = 'own'

        if period == 'current_month':
            reconciliations = [
                reconciliation for reconciliation in reconciliations
                if reconciliation.created_at
                and reconciliation.created_at.year == now.year
                and reconciliation.created_at.month == now.month
            ]
            recon_ids = [reconciliation.id for reconciliation in reconciliations]
        elif period == 'latest' and reconciliations:
            latest_reconciliation = max(
                reconciliations,
                key=lambda reconciliation: reconciliation.completed_at
                    or reconciliation.created_at or datetime.min
            )
            reconciliations = [latest_reconciliation]
            recon_ids = [latest_reconciliation.id]

        if not reconciliations:
            return jsonify({
                'total_reconciliations': 0,
                'total_customer_records': 0, 'total_internal_records': 0,
                'total_rule_matched': 0, 'total_ai_matched': 0,
                'total_manual_review': 0, 'average_match_rate': 0,
                'approval_kpis': {}, 'category_breakdown': [],
                'department_breakdown': [], 'district_breakdown': [],
                'location_reconciliation_chart': [],
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
        avg_rate          = round(total_matched / total_internal * 100, 2) if total_internal else 0

        # ── approval KPIs from ReconciliationRecord ────────────────────────────
        STATUS_COUNTS = db.session.query(
            ReconciliationRecord.approval_status,
            func.count(ReconciliationRecord.id)
        ).filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids)
        ).group_by(ReconciliationRecord.approval_status).all()

        approval_counts = {s: 0 for s in [
            'pending','reconciled','unreconciled','surplus_assets',
            'exist_in_erp_not_physical','duplicated','unique'
        ]}
        for status, cnt in STATUS_COUNTS:
            key = status or 'pending'
            approval_counts[key] = approval_counts.get(key, 0) + cnt

        duplicate_category_count = db.session.query(
            func.count(ReconciliationRecord.id)
        ).filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids),
            ReconciliationRecord.match_category == 'Duplicate'
        ).scalar() or 0
        approval_counts['duplicated'] = duplicate_category_count

        # Build mutually exclusive side-specific buckets. Matched records count
        # on both sides; unmatched and duplicate records count on their source
        # side only. Pending is the remainder, which guarantees exact totals.
        MATCHED_CATEGORIES = {'Exact Match', 'AI Match', 'Manual Review'}
        ERP_STATUS_COUNTS = db.session.query(
            ReconciliationRecord.approval_status,
            ReconciliationRecord.match_category,
            func.count(ReconciliationRecord.id)
        ).filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids)
        ).group_by(
            ReconciliationRecord.approval_status,
            ReconciliationRecord.match_category
        ).all()
        physical_duplicates = sum(r.customer_duplicates or 0 for r in reconciliations)
        erp_duplicates = sum(r.internal_duplicates or 0 for r in reconciliations)
        side_counts = {
            'erp': {'resolved': 0, 'pending': 0, 'approval_pending': 0, 'surplus': 0, 'shortage': 0, 'unmatched': 0, 'duplicate': min(erp_duplicates, total_internal)},
            'physical': {'resolved': 0, 'pending': 0, 'approval_pending': 0, 'surplus': 0, 'shortage': 0, 'unmatched': 0, 'duplicate': min(physical_duplicates, total_customer)},
        }
        for status, category, count in ERP_STATUS_COUNTS:
            status = status or 'pending'
            category = category or ''
            if category == 'Duplicate':
                continue
            sides = ['erp', 'physical'] if category in MATCHED_CATEGORIES else (
                ['erp'] if category == 'ERP Unmatched' else ['physical'] if category == 'Physical Unmatched' else []
            )
            for side in sides:
                if status == 'pending':
                    side_counts[side]['approval_pending'] += count
                if status in {'reconciled', 'unique'}:
                    side_counts[side]['resolved'] += count
                elif status == 'surplus_assets' and side == 'physical':
                    side_counts[side]['surplus'] += count
                elif status == 'exist_in_erp_not_physical' and side == 'erp':
                    side_counts[side]['shortage'] += count
                elif status == 'unreconciled':
                    side_counts[side]['unmatched'] += count
                else:
                    side_counts[side]['pending'] += count

        for side, total in [('erp', total_internal), ('physical', total_customer)]:
            known = sum(side_counts[side].values())
            side_counts[side]['pending'] += max(total - known, 0)
            if side_counts[side]['pending'] > total:
                side_counts[side]['pending'] = total

        erp_side = side_counts['erp']
        physical_side = side_counts['physical']
        resolved_erp = erp_side['resolved']
        pending_erp = erp_side['pending']
        unmatched_erp = erp_side['unmatched']

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
            'exist_erp_not_physical': approval_counts['exist_in_erp_not_physical'],
            'duplicated':           approval_counts['duplicated'],
            'unique':               approval_counts['unique'],
            'pending':              approval_counts['pending'],
            'pending_erp':          pending_erp,
            'unresolved_erp':       pending_erp,
            'resolved_erp':         resolved_erp,
            'erp_match_rate':       round(resolved_erp / total_internal * 100, 2) if total_internal else 0,
            'unmatched_erp':        unmatched_erp,
            'side_counts':          side_counts,
        }

        # ── helpers to extract field from json ─────────────────────────────────
        def _pick(json_data, *keys):
            for k in keys:
                v = json_data.get(k)
                if v and str(v).strip() not in ('', 'nan', 'None'):
                    return str(v).strip()
            return None

        # ── load all records for breakdown analyses ────────────────────────────
        ERP_ANALYTICS_CATEGORIES = {
            'Exact Match', 'AI Match', 'Manual Review', 'ERP Unmatched', 'Duplicate'
        }
        all_records = ReconciliationRecord.query.filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids),
            ReconciliationRecord.match_category.in_(ERP_ANALYTICS_CATEGORIES)
        ).all()
        all_records = [
            rec for rec in all_records
            if rec.match_category != 'Duplicate' or any(
                str(key).startswith('internal_')
                for key in (rec.full_record_json or {})
            )
        ]
        physical_records = ReconciliationRecord.query.filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids),
            ReconciliationRecord.match_category.in_(
                {'Exact Match', 'AI Match', 'Manual Review', 'Physical Unmatched', 'Duplicate'}
            )
        ).all()
        physical_records = [
            rec for rec in physical_records
            if rec.match_category != 'Duplicate' or any(
                str(key).startswith('customer_')
                for key in (rec.full_record_json or {})
            )
        ]

        # ── category breakdown ─────────────────────────────────────────────────
        STATUS_LIST_GLOBAL = ['pending','reconciled','unreconciled','surplus_assets',
                               'exist_in_erp_not_physical','duplicated','unique']

        cat_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            cat = (_pick(j, 'internal_category', 'category') or
                   rec.match_category or 'Unknown')
            if cat not in cat_stats:
                cat_stats[cat] = {s: 0 for s in STATUS_LIST_GLOBAL}
                cat_stats[cat]['total'] = 0
            cat_stats[cat]['total'] += 1
            status = rec.approval_status or 'pending'
            if status == 'surplus_assets':
                status = 'pending'
            cat_stats[cat][status] = cat_stats[cat].get(status, 0) + 1

        category_breakdown = sorted([
            {
                'name':                     k,
                'total':                    v['total'],
                'reconciled':               v.get('reconciled', 0),
                'unreconciled':             v.get('unreconciled', 0),
                'surplus_assets':           v.get('surplus_assets', 0),
                'exist_in_erp_not_physical':v.get('exist_in_erp_not_physical', 0),
                'duplicated':               v.get('duplicated', 0),
                'unique':                   v.get('unique', 0),
                'pending':                  v.get('pending', 0),
                'rate': round(v.get('reconciled', 0) / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in cat_stats.items()
        ], key=lambda x: -x['rate'])

        # ── department breakdown ───────────────────────────────────────────────
        dept_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dept = _pick(j, 'internal_department', 'department') or 'Unknown'
            if dept not in dept_stats:
                dept_stats[dept] = {s: 0 for s in STATUS_LIST_GLOBAL}
                dept_stats[dept]['total'] = 0
            dept_stats[dept]['total'] += 1
            status = rec.approval_status or 'pending'
            if status == 'surplus_assets':
                status = 'pending'
            dept_stats[dept][status] = dept_stats[dept].get(status, 0) + 1

        department_breakdown = sorted([
            {
                'name':                     k,
                'total':                    v['total'],
                'reconciled':               v.get('reconciled', 0),
                'unreconciled':             v.get('unreconciled', 0),
                'surplus_assets':           v.get('surplus_assets', 0),
                'exist_in_erp_not_physical':v.get('exist_in_erp_not_physical', 0),
                'duplicated':               v.get('duplicated', 0),
                'unique':                   v.get('unique', 0),
                'pending':                  v.get('pending', 0),
                'rate': round(v.get('reconciled', 0) / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in dept_stats.items()
        ], key=lambda x: -x['rate'])

        # ── district/branch breakdown ──────────────────────────────────────────
        dist_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dist = _pick(j, 'internal_district', 'district') or 'Unknown'
            if dist not in dist_stats:
                dist_stats[dist] = {s: 0 for s in STATUS_LIST_GLOBAL}
                dist_stats[dist]['total'] = 0
            dist_stats[dist]['total'] += 1
            status = rec.approval_status or 'pending'
            if status == 'surplus_assets':
                status = 'pending'
            dist_stats[dist][status] = dist_stats[dist].get(status, 0) + 1

        district_breakdown = sorted([
            {
                'name':                     k,
                'total':                    v['total'],
                'reconciled':               v.get('reconciled', 0),
                'unreconciled':             v.get('unreconciled', 0),
                'surplus_assets':           v.get('surplus_assets', 0),
                'exist_in_erp_not_physical':v.get('exist_in_erp_not_physical', 0),
                'duplicated':               v.get('duplicated', 0),
                'unique':                   v.get('unique', 0),
                'pending':                  v.get('pending', 0),
                'rate': round(v.get('reconciled', 0) / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in dist_stats.items()
        ], key=lambda x: -x['rate'])

        # ── location reconciliation summary ──────────────────────────────────
        def _norm_location(value):
            if value and str(value).strip() not in ('', 'nan', 'None'):
                return str(value).strip().upper()
            return None

        location_counts = {
            key: {status: 0 for status in STATUS_LIST_GLOBAL} | {'total': 0}
            for key in ('Same', 'Same Dept, Diff District',
                        'Diff Dept, Same District', 'Different', 'N/A')
        }
        for rec in all_records:
            j = rec.full_record_json or {}
            customer_department = _norm_location(_pick(j, 'customer_department', 'department'))
            internal_department = _norm_location(_pick(j, 'internal_department'))
            customer_district = _norm_location(_pick(j, 'customer_district', 'district'))
            internal_district = _norm_location(_pick(j, 'internal_district'))
            department_same = bool(customer_department and internal_department and customer_department == internal_department)
            district_same = bool(customer_district and internal_district and customer_district == internal_district)
            has_departments = bool(customer_department and internal_department)
            has_districts = bool(customer_district and internal_district)

            if not has_departments and not has_districts:
                location_key = 'N/A'
            elif has_departments and has_districts:
                if department_same and district_same:
                    location_key = 'Same'
                elif department_same:
                    location_key = 'Same Dept, Diff District'
                elif district_same:
                    location_key = 'Diff Dept, Same District'
                else:
                    location_key = 'Different'
            elif has_departments:
                location_key = 'Same' if department_same else 'Different'
            else:
                location_key = 'Same' if district_same else 'Different'
            location_counts[location_key]['total'] += 1
            status_key = rec.approval_status or 'pending'
            location_counts[location_key][status_key] = \
                location_counts[location_key].get(status_key, 0) + 1

        location_reconciliation_chart = [
            {
                'name': key,
                'value': values['total'],
                'total': values['total'],
                **{status: values.get(status, 0) for status in STATUS_LIST_GLOBAL},
                'color': {
                    'Same': '#10b981', 'Same Dept, Diff District': '#3b82f6',
                    'Diff Dept, Same District': '#f97316', 'Different': '#ef4444',
                    'N/A': '#9ca3af'
                }.get(key, '#9ca3af')
            }
            for key, values in location_counts.items() if values['total'] > 0
        ]

        def build_side_breakdowns(records, side):
            status_keys = ['pending', 'reconciled', 'unreconciled',
                           'surplus_assets', 'exist_in_erp_not_physical',
                           'duplicated', 'unique']
            field_sets = {
                'category': ('internal_category', 'category') if side == 'erp'
                    else ('customer_category', 'category'),
                'department': ('internal_department', 'department') if side == 'erp'
                    else ('customer_department', 'department'),
                'district': ('internal_district', 'district') if side == 'erp'
                    else ('customer_district', 'district'),
            }
            result = {}
            for dimension, keys in field_sets.items():
                stats = {}
                for rec in records:
                    j = rec.full_record_json or {}
                    name = _pick(j, *keys) or rec.match_category or 'Unknown'
                    if name not in stats:
                        stats[name] = {status: 0 for status in status_keys}
                    status = rec.approval_status or 'pending'
                    if side == 'erp' and status == 'surplus_assets':
                        status = 'pending'
                    if side == 'physical' and status == 'exist_in_erp_not_physical':
                        status = 'pending'
                    stats[name][status] = stats[name].get(status, 0) + 1
                result[dimension] = sorted([
                    {
                        'name': name,
                        'total': sum(values.values()),
                        **{status: values.get(status, 0) for status in status_keys},
                        'rate': round(values.get('reconciled', 0) / sum(values.values()) * 100, 1)
                            if sum(values.values()) else 0,
                    }
                    for name, values in stats.items()
                ], key=lambda row: -row['rate'])
            return result

        physical_breakdowns = build_side_breakdowns(physical_records, 'physical')

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
            monthly[key]['total']   += r.total_internal_records
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

        processing_seconds = sum(
            max((r.completed_at - r.created_at).total_seconds(), 0)
            for r in reconciliations if r.completed_at and r.created_at
        )
        last_reconciliation_processing_seconds = processing_seconds
        if period == 'latest' and reconciliations:
            latest_reconciliation = reconciliations[0]
            processing_seconds = (
                max((latest_reconciliation.completed_at - latest_reconciliation.created_at).total_seconds(), 0)
                if latest_reconciliation.completed_at and latest_reconciliation.created_at
                else 0
            )
            last_reconciliation_processing_seconds = processing_seconds

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
            'location_reconciliation_chart': location_reconciliation_chart,
            'category_breakdown_physical': physical_breakdowns['category'],
            'department_breakdown_physical': physical_breakdowns['department'],
            'district_breakdown_physical': physical_breakdowns['district'],
            'monthly_trend':          monthly_trend,
            'processing_time_seconds': processing_seconds,
            'last_reconciliation_processing_seconds': last_reconciliation_processing_seconds,
            'last_reconciliation': reconciliations[0].to_dict() if period == 'latest' else None,
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
        
        if not reconciliation or reconciliation.is_deleted:
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
def approve_record():
    """
    Check or approve a single record in a maker -> checker -> approver flow.
    Officers check records; managers/admins approve them. The existing UI still
    sends a single approval_decision, and the stage is inferred from role.
    """
    VALID_DECISIONS = [
        'pending', 'reconciled', 'unreconciled',
        'surplus_assets', 'exist_in_erp_not_physical',
        'duplicated', 'unique'
    ]
    try:
        data = request.get_json()
        record_id = data.get('record_id')
        approval_decision = data.get('approval_decision')
        decision_stage = (data.get('decision_stage') or data.get('stage') or '').strip().lower()

        if not record_id or not approval_decision:
            return jsonify({'error': 'Missing required fields: record_id, approval_decision'}), 400

        if approval_decision not in VALID_DECISIONS:
            return jsonify({
                'error': 'Invalid approval_decision',
                'allowed': VALID_DECISIONS
            }), 400

        if decision_stage not in ['', 'check', 'checker', 'approve', 'approver']:
            return jsonify({'error': 'Invalid decision_stage. Use check or approve'}), 400

        record = ReconciliationRecord.query.get(record_id)
        if not record:
            return jsonify({'error': 'Record not found'}), 404

        reconciliation = Reconciliation.query.get(record.reconciliation_id)
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        current_user = get_user_from_token()
        if not _user_can_approve_reconciliation(reconciliation, current_user.id, current_user.role):
            return jsonify({'error': 'Access denied', 'message': 'Only managers/admins or the assigned officer can review these records.'}), 403

        if current_user.role not in ['manager', 'admin'] and current_user.id == record.maker_user_id:
            return jsonify({'error': 'The maker cannot check or approve their own record.'}), 403

        if current_user.role in ['manager', 'admin']:
            stage = 'approver' if (decision_stage or '').lower() in ['approve', 'approver'] else 'checker'
        else:
            stage = 'checker'

        if stage == 'approver' and current_user.role not in ['manager', 'admin']:
            return jsonify({'error': 'Only managers or admins may approve checked records.'}), 403

        if stage == 'approver' and (record.checker_status or record.check_status or 'pending') in [None, '', 'pending', 'checking']:
            return jsonify({'error': 'This record must be checked before it can be approved.'}), 400

        if stage == 'checker':
            record.check_status = approval_decision
            record.checker_status = approval_decision
            record.checked_by = current_user.id
            record.checked_at = datetime.utcnow()
            actor_name = current_user.username
            action_type = 'CHECK_RECORD'
        else:
            if (record.checker_status or record.check_status or 'pending') in [None, '', 'pending', 'checking']:
                return jsonify({'error': 'This record must be checked before it can be approved'}), 400
            record.approval_status = approval_decision
            record.approver_status = approval_decision
            record.approved_by = current_user.id
            record.approved_at = datetime.utcnow()
            actor_name = current_user.username
            action_type = 'APPROVE_RECORD'

        db.session.commit()

        AuditService.log_operation(
            user_id=current_user.id,
            operation_type=action_type,
            resource_type='reconciliation_records',
            resource_id=record_id,
            details={
                'decision_stage': stage,
                'approval_decision': approval_decision,
                'reconciliation_id': record.reconciliation_id,
                'match_category': record.match_category
            }
        )

        return jsonify({
            'message': f'Record {record_id} marked as {approval_decision} by {stage}',
            'record_id': record_id,
            'decision_stage': stage,
            'approval_status': record.approval_status or record.approver_status or 'pending',
            'approver_status': record.approver_status or record.approval_status or 'pending',
            'check_status': record.check_status or record.checker_status or 'pending',
            'checker_status': record.checker_status or record.check_status or 'pending',
            'actor': actor_name,
            'actor_role': current_user.role
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/records/approve-group', methods=['POST'])
@jwt_required()
def approve_group():
    """
    Check or approve a group of records by category in the maker -> checker -> approver flow.
    Officers perform checker-review, managers/admins final approver action.
    """
    try:
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        category = data.get('category')
        approval_decision = data.get('approval_decision')
        decision_stage = (data.get('decision_stage') or data.get('stage') or '').strip().lower()

        if not all([reconciliation_id, category, approval_decision]):
            return jsonify({
                'error': 'Missing required fields',
                'required': ['reconciliation_id', 'category', 'approval_decision']
            }), 400

        VALID_DECISIONS = [
            'reconciled', 'unreconciled', 'surplus_assets',
            'exist_in_erp_not_physical', 'duplicated', 'unique'
        ]
        if approval_decision not in VALID_DECISIONS:
            return jsonify({
                'error': 'Invalid approval_decision',
                'allowed': VALID_DECISIONS
            }), 400

        if decision_stage not in ['', 'check', 'checker', 'approve', 'approver']:
            return jsonify({'error': 'Invalid decision_stage. Use check or approve'}), 400

        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if not reconciliation.report_path or not os.path.exists(reconciliation.report_path):
            return jsonify({'error': 'Report file not found'}), 404

        current_user = get_user_from_token()
        if not _user_can_approve_reconciliation(reconciliation, current_user.id, current_user.role):
            return jsonify({'error': 'Access denied', 'message': 'Only managers/admins or the assigned officer can review these records.'}), 403

        if current_user.role not in ['manager', 'admin'] and current_user.id == reconciliation.user_id:
            return jsonify({'error': 'The maker cannot check or approve records they created.'}), 403

        stage = 'approver' if current_user.role in ['manager', 'admin'] and (decision_stage or '').lower() in ['approve', 'approver'] else 'checker'
        if current_user.role not in ['manager', 'admin']:
            stage = 'checker'

        if stage == 'approver':
            if category == 'Unmatched':
                category_filter = db.or_(
                    ReconciliationRecord.match_category == 'Physical Unmatched',
                    ReconciliationRecord.match_category == 'ERP Unmatched'
                )
            else:
                category_filter = ReconciliationRecord.match_category == category

            pending_checked = ReconciliationRecord.query.filter(
                ReconciliationRecord.reconciliation_id == reconciliation_id,
                category_filter,
                db.or_(
                    ReconciliationRecord.check_status.in_([None, '', 'pending', 'checking']),
                    ReconciliationRecord.checker_status.in_([None, '', 'pending', 'checking'])
                )
            ).count()
            if pending_checked > 0:
                return jsonify({'error': 'This category still contains unchecked records. Complete the checker stage before approving.'}), 400

        existing_count = ReconciliationRecord.query.filter_by(
            reconciliation_id=reconciliation_id
        ).count()
        
        records_created = 0
        
        if existing_count == 0:
            print(f"No records in DB, parsing from Excel file...")
            excel_file = pd.ExcelFile(reconciliation.report_path)
            sheet_mapping = {
                'Exact_Matched_By_Tag': 'Exact Match',
                'AI_Matched_Need_Manual_Review': 'AI Match',
                'Matched_Need_Manual_Review': 'Manual Review',
                'Physical_Unmatched': 'Physical Unmatched',
                'ERP_Unmatched': 'ERP Unmatched',
                'Physical_Duplicates': 'Duplicate',
                'ERP_Duplicates': 'Duplicate'
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
                            maker_user_id=reconciliation.user_id,
                            full_record_json=cleaned_dict,
                            check_status='pending',
                            approval_status='duplicated' if match_type == 'Duplicate' else 'pending'
                        )
                        db.session.add(record)
                        records_created += 1
            
            db.session.flush()
            print(f"Created {records_created} records in database")
        
        if category == 'Unmatched':
            records = ReconciliationRecord.query.filter(
                ReconciliationRecord.reconciliation_id == reconciliation_id,
                db.or_(
                    ReconciliationRecord.match_category == 'Physical Unmatched',
                    ReconciliationRecord.match_category == 'ERP Unmatched'
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
        
        updated_count = 0
        for record in records:
            if stage == 'checker':
                record.check_status = approval_decision
                record.checker_status = approval_decision
                record.checked_by = current_user.id
                record.checked_at = datetime.utcnow()
            else:
                if (record.checker_status or record.check_status or 'pending') in [None, '', 'pending', 'checking']:
                    return jsonify({'error': 'All records in this category must be checked before approval'}), 400
                record.approval_status = approval_decision
                record.approver_status = approval_decision
                record.approved_by = current_user.id
                record.approved_at = datetime.utcnow()
            updated_count += 1

        db.session.commit()

        AuditService.log_operation(
            user_id=current_user.id,
            operation_type='APPROVE_RECORD_GROUP',
            resource_type='reconciliation_records',
            resource_id=reconciliation_id,
            details={
                'decision_stage': stage,
                'category': category,
                'approval_decision': approval_decision,
                'records_count': updated_count,
                'records_created': records_created,
                'reconciliation_user_id': reconciliation.user_id
            }
        )

        message = f'Successfully {stage}ed {updated_count} records'
        if records_created > 0:
            message += f' and saved {records_created} total records to database'

        return jsonify({
            'message': message,
            'category': category,
            'decision_stage': stage,
            'approval_decision': approval_decision,
            'records_updated': updated_count,
            'records_created': records_created,
            'actor': current_user.username
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
    Officers can only view their own reconciliations; managers/admins can view any.
    """
    try:
        user_id = int(get_jwt_identity())
        user_role = get_user_role()

        # Verify reconciliation exists
        reconciliation = Reconciliation.query.get(reconciliation_id)
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({'error': 'Access denied',
                            'message': 'You can only view your own or assigned reconciliation records.'}), 403

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
                    'exist_in_erp_not_physical': 0,
                }
            summary[match_category]['total'] += count
            key = approval_status or 'pending'
            if key in summary[match_category]:
                summary[match_category][key] += count
            else:
                summary[match_category][key] = count
        
        # Group unmatched categories
        if 'Physical Unmatched' in summary or 'ERP Unmatched' in summary:
            unmatched_summary = {
                'total': 0, 'pending': 0, 'reconciled': 0,
                'unreconciled': 0, 'not_reconciled': 0,
                'surplus_assets': 0,
                'exist_in_erp_not_physical': 0,
                'duplicated': 0, 'unique': 0,
            }
            for key in ['Physical Unmatched', 'ERP Unmatched']:
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
        
        if not reconciliation or reconciliation.is_deleted:
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
        
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own or assigned reconciliation records.'
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
            'Physical_Unmatched': 'Physical Unmatched',
            'ERP_Unmatched': 'ERP Unmatched',
        }
        
        all_records = []
        
        for sheet_name, match_type in sheet_mapping.items():
            # Skip if filtering by category and this isn't the category
            if category != 'all':
                if category == 'Unmatched' and match_type not in ['Physical Unmatched', 'ERP Unmatched']:
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
        
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only view your own or assigned reconciliation records.'
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
                        ReconciliationRecord.match_category == 'Physical Unmatched',
                        ReconciliationRecord.match_category == 'ERP Unmatched'
                    )
                )
                print(f"Filtering for: Physical Unmatched OR ERP Unmatched")
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
            
            maker_user = record.maker or (record.reconciliation.user if record.reconciliation else None)
            checker_user = record.checker
            approver_user = record.approver

            maker_name = maker_user.username if maker_user else None
            checker_name = checker_user.username if checker_user else None
            approver_name = approver_user.username if approver_user else None

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

            is_unmatched = record.match_category in ('Physical Unmatched', 'ERP Unmatched')
            is_internal_unmatched = record.match_category == 'ERP Unmatched'

            # ── customer side ──────────────────────────────────────────────────
            if is_unmatched and is_internal_unmatched:
                # ERP Unmatched: raw cols are the internal side
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
                # Physical Unmatched: no internal side
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
                # ERP Unmatched: raw cols ARE the internal side
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
                'approver_status': getattr(record, 'approver_status', None) or approval_status,
                'check_status': getattr(record, 'check_status', None) or getattr(record, 'checker_status', None) or 'pending',
                'checker_status': getattr(record, 'checker_status', None) or getattr(record, 'check_status', None) or 'pending',
                'maker_user_id': record.maker_user_id or (record.reconciliation.user_id if record.reconciliation else None),
                'maker_username': maker_name,
                'checked_by': record.checked_by,
                'checked_by_username': checker_name,
                'checker_username': checker_name,
                'approved_by': record.approved_by,
                'approved_by_username': approver_name,
                'approver_username': approver_name,
                'approved_at': approved_at.isoformat() if approved_at else None,
                'full_data': json_data
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
        
        if not reconciliation or reconciliation.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Role-based access control
        if user_role == 'officer' and not _user_can_access_reconciliation(reconciliation, user_id, user_role):
            return jsonify({
                'error': 'Access denied',
                'message': 'You can only record your own or assigned reconciliation results.'
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
            'Physical_Unmatched': 'Physical Unmatched',
            'ERP_Unmatched': 'ERP Unmatched',
            'Physical_Duplicates': 'Duplicate',
            'ERP_Duplicates': 'Duplicate'
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


# ── Per-reconciliation analytics ─────────────────────────────────────────────
@reconciliation_bp.route('/analytics/single/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_reconciliation_analytics(reconciliation_id):
    """
    Single-reconciliation analytics derived from approved ReconciliationRecord rows.
    Returns KPIs, approval breakdown, category/dept/district performance, and aging stub.
    """
    try:
        from sqlalchemy import func
        report_side = request.args.get('side', 'erp').lower()
        if report_side not in {'erp', 'physical'}:
            report_side = 'erp'
        user_id   = int(get_jwt_identity())
        user_role = get_user_role()

        recon = Reconciliation.query.get(reconciliation_id)
        if not recon or recon.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        if user_role == 'officer' and recon.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        # ── approval status counts ─────────────────────────────────────────
        STATUS_LIST = [
            'pending','reconciled','unreconciled','surplus_assets',
            'exist_in_erp_not_physical','duplicated','unique'
        ]
        status_rows = db.session.query(
            ReconciliationRecord.approval_status,
            func.count(ReconciliationRecord.id)
        ).filter_by(reconciliation_id=reconciliation_id).group_by(
            ReconciliationRecord.approval_status
        ).all()

        approval_counts = {s: 0 for s in STATUS_LIST}
        for status, cnt in status_rows:
            k = status or 'pending'
            approval_counts[k] = approval_counts.get(k, 0) + cnt

        duplicate_category_count = db.session.query(
            func.count(ReconciliationRecord.id)
        ).filter_by(
            reconciliation_id=reconciliation_id,
            match_category='Duplicate'
        ).scalar() or 0
        approval_counts['duplicated'] = duplicate_category_count

        total_db = sum(approval_counts.values())
        recon_rate = round(
            approval_counts['reconciled'] / total_db * 100, 2
        ) if total_db else 0

        kpis = {
            'total_erp_assets':           recon.total_internal_records,
            'physical_count':             recon.total_customer_records,
            'reconciled':                 approval_counts['reconciled'],
            'reconciliation_rate':        recon_rate,
            'unreconciled':               approval_counts['unreconciled'],
            'surplus_assets':             approval_counts['surplus_assets'],
            'exist_erp_not_physical':     approval_counts['exist_in_erp_not_physical'],
            'duplicated':                 approval_counts['duplicated'],
            'unique':                     approval_counts['unique'],
            'pending':                    approval_counts['pending'],
            'exact_matched':              recon.rule_matched,
            'ai_matched':                 recon.ai_matched,
            'near_match':                 recon.manual_review,
            'customer_unmatched':         recon.customer_unmatched,
            'internal_unmatched':         recon.internal_unmatched,
            'customer_duplicates':        recon.customer_duplicates or 0,
            'internal_duplicates':        recon.internal_duplicates or 0,
        }

        # Side-specific accounting for the single-reconciliation report.
        matched_categories = {'Exact Match', 'AI Match', 'Manual Review'}
        side_counts = {
            'erp': {'resolved': 0, 'pending': 0, 'approval_pending': 0, 'surplus': 0, 'shortage': 0, 'unmatched': 0, 'duplicate': min(recon.internal_duplicates or 0, recon.total_internal_records)},
            'physical': {'resolved': 0, 'pending': 0, 'approval_pending': 0, 'surplus': 0, 'shortage': 0, 'unmatched': 0, 'duplicate': min(recon.customer_duplicates or 0, recon.total_customer_records)},
        }
        category_status_rows = db.session.query(
            ReconciliationRecord.match_category,
            ReconciliationRecord.approval_status,
            func.count(ReconciliationRecord.id)
        ).filter_by(reconciliation_id=reconciliation_id).group_by(
            ReconciliationRecord.match_category,
            ReconciliationRecord.approval_status
        ).all()
        for category, status, count in category_status_rows:
            status = status or 'pending'
            if category == 'Duplicate':
                continue
            sides = ['erp', 'physical'] if category in matched_categories else (
                ['erp'] if category == 'ERP Unmatched' else ['physical'] if category == 'Physical Unmatched' else []
            )
            for side in sides:
                if status == 'pending':
                    side_counts[side]['approval_pending'] += count
                if status in {'reconciled', 'unique'}:
                    side_counts[side]['resolved'] += count
                elif status == 'surplus_assets' and side == 'physical':
                    side_counts[side]['surplus'] += count
                elif status == 'exist_in_erp_not_physical' and side == 'erp':
                    side_counts[side]['shortage'] += count
                elif status == 'unreconciled':
                    side_counts[side]['unmatched'] += count
                else:
                    side_counts[side]['pending'] += count
        for side, total in [('erp', recon.total_internal_records), ('physical', recon.total_customer_records)]:
            known = sum(side_counts[side].values())
            side_counts[side]['pending'] += max(total - known, 0)
            side_counts[side]['pending'] = min(side_counts[side]['pending'], total)
        kpis['side_counts'] = side_counts
        kpis['resolved_erp'] = side_counts['erp']['resolved']
        kpis['pending_erp'] = side_counts['erp']['pending']
        kpis['unmatched_erp'] = side_counts['erp']['unmatched']
        kpis['erp_match_rate'] = round(
            side_counts['erp']['resolved'] / recon.total_internal_records * 100, 2
        ) if recon.total_internal_records else 0

        # ── helper ─────────────────────────────────────────────────────────
        def _pick(j, *keys):
            for k in keys:
                v = j.get(k)
                if v and str(v).strip() not in ('', 'nan', 'None'):
                    return str(v).strip()
            return None

        all_records = ReconciliationRecord.query.filter_by(
            reconciliation_id=reconciliation_id
        ).all()
        report_categories = {'Exact Match', 'AI Match', 'Manual Review',
                             'ERP Unmatched' if report_side == 'erp' else 'Physical Unmatched',
                             'Duplicate'}
        duplicate_prefix = 'internal_' if report_side == 'erp' else 'customer_'
        all_records = [
            rec for rec in all_records
            if rec.match_category in report_categories and (
                rec.match_category != 'Duplicate' or any(
                    str(key).startswith(duplicate_prefix)
                    for key in (rec.full_record_json or {})
                )
            )
        ]

        # ── category breakdown ─────────────────────────────────────────────
        cat_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            cat = (_pick(j, ('internal_category' if report_side == 'erp' else 'customer_category'), 'category')
                   or rec.match_category or 'Unknown')
            if cat not in cat_stats:
                cat_stats[cat] = {s: 0 for s in STATUS_LIST}
                cat_stats[cat]['total'] = 0
            cat_stats[cat]['total'] += 1
            status_key = rec.approval_status or 'pending'
            if status_key not in cat_stats[cat]:
                cat_stats[cat][status_key] = 0
            cat_stats[cat][status_key] += 1

        category_breakdown = sorted([
            {
                'name':                     k,
                'total':                    v['total'],
                'reconciled':               v.get('reconciled', 0),
                'unreconciled':             v.get('unreconciled', 0),
                'surplus_assets':           v.get('surplus_assets', 0),
                'exist_in_erp_not_physical':v.get('exist_in_erp_not_physical', 0),
                'duplicated':               v.get('duplicated', 0),
                'unique':                   v.get('unique', 0),
                'pending':                  v.get('pending', 0),
                'rate': round(v.get('reconciled', 0) / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in cat_stats.items() if k != 'Unknown'
        ], key=lambda x: -x['rate'])[:15]

        # ── department breakdown ───────────────────────────────────────────
        dept_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dept = _pick(j, ('internal_department' if report_side == 'erp' else 'customer_department'), 'department') or 'Unknown'
            if dept == 'Unknown': continue
            if dept not in dept_stats:
                dept_stats[dept] = {s: 0 for s in STATUS_LIST}
                dept_stats[dept]['total'] = 0
            dept_stats[dept]['total'] += 1
            dept_stats[dept][rec.approval_status or 'pending'] = \
                dept_stats[dept].get(rec.approval_status or 'pending', 0) + 1

        department_breakdown = sorted([
            {
                'name':                     k,
                'total':                    v['total'],
                'reconciled':               v.get('reconciled', 0),
                'unreconciled':             v.get('unreconciled', 0),
                'surplus_assets':           v.get('surplus_assets', 0),
                'exist_in_erp_not_physical':v.get('exist_in_erp_not_physical', 0),
                'duplicated':               v.get('duplicated', 0),
                'unique':                   v.get('unique', 0),
                'pending':                  v.get('pending', 0),
                'rate': round(v.get('reconciled', 0) / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in dept_stats.items()
        ], key=lambda x: -x['rate'])[:15]

        # ── district breakdown ─────────────────────────────────────────────
        dist_stats = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dist = _pick(j, ('internal_district' if report_side == 'erp' else 'customer_district'), 'district') or 'Unknown'
            if dist == 'Unknown': continue
            if dist not in dist_stats:
                dist_stats[dist] = {s: 0 for s in STATUS_LIST}
                dist_stats[dist]['total'] = 0
            dist_stats[dist]['total'] += 1
            dist_stats[dist][rec.approval_status or 'pending'] = \
                dist_stats[dist].get(rec.approval_status or 'pending', 0) + 1

        district_breakdown = sorted([
            {
                'name':                     k,
                'total':                    v['total'],
                'reconciled':               v.get('reconciled', 0),
                'unreconciled':             v.get('unreconciled', 0),
                'surplus_assets':           v.get('surplus_assets', 0),
                'exist_in_erp_not_physical':v.get('exist_in_erp_not_physical', 0),
                'duplicated':               v.get('duplicated', 0),
                'unique':                   v.get('unique', 0),
                'pending':                  v.get('pending', 0),
                'rate': round(v.get('reconciled', 0) / v['total'] * 100, 1) if v['total'] else 0
            }
            for k, v in dist_stats.items()
        ], key=lambda x: -x['rate'])[:15]

        # ── dept_reconcile summary ─────────────────────────────────────────
        def _norm_dept(v):
            if v and str(v).strip() not in ('', 'nan', 'None'):
                return str(v).strip().upper()
            return None

        dept_rec_counts = {
            key: {status: 0 for status in STATUS_LIST} | {'total': 0}
            for key in ('Same', 'Same Dept, Diff District',
                        'Diff Dept, Same District', 'Different', 'N/A')
        }
        for rec in all_records:
            j   = rec.full_record_json or {}
            c_d = _pick(j, 'customer_department', 'department')
            i_d = _pick(j, 'internal_department')
            c_s = _pick(j, 'customer_district',   'district')
            i_s = _pick(j, 'internal_district')

            cd, id_, cs, is_ = _norm_dept(c_d), _norm_dept(i_d), _norm_dept(c_s), _norm_dept(i_s)
            dept_same = bool(cd and id_ and cd == id_)
            dist_same = bool(cs and is_ and cs == is_)
            da, sa    = bool(cd and id_), bool(cs and is_)

            if not da and not sa:
                dept_key = 'N/A'
            elif da and sa:
                if dept_same and dist_same:   dept_key = 'Same'
                elif dept_same:               dept_key = 'Same Dept, Diff District'
                elif dist_same:               dept_key = 'Diff Dept, Same District'
                else:                         dept_key = 'Different'
            elif da:
                dept_key = 'Same' if dept_same else 'Different'
            else:
                dept_key = 'Same' if dist_same else 'Different'

            dept_rec_counts[dept_key]['total'] += 1
            status_key = rec.approval_status or 'pending'
            dept_rec_counts[dept_key][status_key] = \
                dept_rec_counts[dept_key].get(status_key, 0) + 1

        dept_rec_chart = [
            {
                'name': key,
                'value': values['total'],
                'total': values['total'],
                **{status: values.get(status, 0) for status in STATUS_LIST},
                'color': {
                    'Same': '#10b981', 'Same Dept, Diff District': '#3b82f6',
                    'Diff Dept, Same District': '#f97316', 'Different': '#ef4444', 'N/A': '#9ca3af'
                }.get(key, '#9ca3af')
            }
            for key, values in dept_rec_counts.items() if values['total'] > 0
        ]

        chart_side = side_counts[report_side]
        donut = [
            {'name': 'Reconciled', 'value': chart_side['resolved'], 'color': '#10b981'},
            {'name': 'Unreconciled', 'value': chart_side['unmatched'], 'color': '#ef4444'},
            {'name': 'Shortage' if report_side == 'erp' else 'Surplus',
             'value': chart_side['shortage'] if report_side == 'erp' else chart_side['surplus'],
             'color': '#8b5cf6'},
            {'name': 'Duplicated', 'value': chart_side['duplicate'], 'color': '#ec4899'},
            {'name': 'Pending', 'value': chart_side['approval_pending'], 'color': '#9ca3af'},
        ]

        return jsonify({
            'reconciliation': recon.to_dict(),
            'kpis':                kpis,
            'donut':               donut,
            'category_breakdown':  category_breakdown,
            'department_breakdown':department_breakdown,
            'district_breakdown':  district_breakdown,
            'dept_rec_chart':      dept_rec_chart,
            'location_reconciliation_chart': dept_rec_chart,
            'total_records_in_db': total_db,
            'report_side': report_side,
            'processing_time_seconds': max((recon.completed_at - recon.created_at).total_seconds(), 0)
                if recon.completed_at and recon.created_at else 0,
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Aging analysis endpoint ───────────────────────────────────────────────────
@reconciliation_bp.route('/analytics/aging', methods=['GET'])
@jwt_required()
def get_aging_analysis():
    """
    Compute asset aging from Finance (internal) records.
    Uses the 'year' field from full_record_json and compares to current year.
    Groups into age buckets: <1yr, 1-3yr, 3-5yr, 5-10yr, 10-20yr, >20yr
    """
    try:
        from datetime import date
        report_side = request.args.get('side', 'erp').lower()
        if report_side not in {'erp', 'physical'}:
            report_side = 'erp'
        period = request.args.get('period', 'all').lower()
        user_id   = int(get_jwt_identity())
        user_role = get_user_role()

        if user_role in ['manager', 'admin']:
            reconciliations = Reconciliation.query.filter_by(status='completed', is_deleted=False).all()
            recon_ids = [r.id for r in reconciliations]
        else:
            reconciliations = Reconciliation.query.filter_by(
                user_id=user_id, status='completed', is_deleted=False).all()
            recon_ids = [r.id for r in reconciliations]

        if period == 'current_month':
            now = date.today()
            reconciliations = [
                reconciliation for reconciliation in reconciliations
                if reconciliation.created_at
                and reconciliation.created_at.year == now.year
                and reconciliation.created_at.month == now.month
            ]
            recon_ids = [reconciliation.id for reconciliation in reconciliations]
        elif period == 'latest' and reconciliations:
            latest_reconciliation = max(
                reconciliations,
                key=lambda reconciliation: reconciliation.created_at or datetime.min
            )
            reconciliations = [latest_reconciliation]
            recon_ids = [latest_reconciliation.id]

        if not recon_ids:
            return jsonify({'buckets': [], 'current_year': date.today().year}), 200

        current_year = date.today().year

        # Only Finance-side records (internal) — unmatched, matched, duplicate
        FINANCE_CATEGORIES = ['Exact Match', 'AI Match', 'Manual Review',
                      'ERP Unmatched' if report_side == 'erp' else 'Physical Unmatched',
                      'Duplicate']

        records = ReconciliationRecord.query.filter(
            ReconciliationRecord.reconciliation_id.in_(recon_ids),
            ReconciliationRecord.match_category.in_(FINANCE_CATEGORIES)
        ).all()
        records = [
            rec for rec in records
            if rec.match_category != 'Duplicate' or any(
                str(key).startswith('internal_' if report_side == 'erp' else 'customer_')
                for key in (rec.full_record_json or {})
            )
        ]

        ERP_STATUS_KEYS = ['reconciled','unreconciled','pending',
                   'exist_erp_not_physical' if report_side == 'erp' else 'surplus_assets',
                   'duplicated','unique']
        buckets_map = {
            bucket: {status: 0 for status in ERP_STATUS_KEYS}
            for bucket in ['< 1 yr', '1 – 3 yr', '3 – 5 yr', '5 – 10 yr',
                           '10 – 20 yr', '> 20 yr', 'Unknown']
        }

        for rec in records:
            j = rec.full_record_json or {}
            year_prefix = 'internal_' if report_side == 'erp' else 'customer_'
            raw_year = j.get(f'{year_prefix}year') or j.get(f'{year_prefix}Year')
            # DO NOT fall back to j.get('year') — that could be customer data
            try:
                asset_year = int(float(str(raw_year).strip()))
                age = current_year - asset_year
                if age < 1:          bucket_key = '< 1 yr'
                elif age < 4:        bucket_key = '1 – 3 yr'
                elif age < 6:        bucket_key = '3 – 5 yr'
                elif age < 11:       bucket_key = '5 – 10 yr'
                elif age < 21:       bucket_key = '10 – 20 yr'
                else:                bucket_key = '> 20 yr'
            except (ValueError, TypeError):
                bucket_key = 'Unknown'

            status = rec.approval_status or 'pending'
            if status == 'surplus_assets' and report_side == 'erp':
                status = 'pending'
            buckets_map[bucket_key][status] = buckets_map[bucket_key].get(status, 0) + 1

        BUCKET_ORDER = ['< 1 yr','1 – 3 yr','3 – 5 yr','5 – 10 yr','10 – 20 yr','> 20 yr','Unknown']
        result = []
        simple_buckets = []
        for b in BUCKET_ORDER:
            row = dict({'bucket': b}, **buckets_map[b])
            row['total'] = sum(buckets_map[b].values())
            if row['total'] > 0:
                result.append(row)
                simple_buckets.append({'bucket': b, 'count': row['total']})

        return jsonify({
            'buckets': simple_buckets,       # backward-compat for Dashboard aging chart
            'stacked_buckets': result,        # new: stacked by approval status
            'current_year': current_year,
            'total_records': len(records)
            , 'side': report_side
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Per-reconciliation aging + dept/branch charts ─────────────────────────────
@reconciliation_bp.route('/analytics/aging/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_reconciliation_aging(reconciliation_id):
    """
    Per-reconciliation aging from Finance records broken down by approval status.
    Also returns department and district breakdowns with approval status stacks.
    """
    try:
        from datetime import date
        report_side = request.args.get('side', 'erp').lower()
        if report_side not in {'erp', 'physical'}:
            report_side = 'erp'
        user_id   = int(get_jwt_identity())
        user_role = get_user_role()

        recon = Reconciliation.query.get(reconciliation_id)
        if not recon or recon.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404
        if user_role == 'officer' and recon.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        current_year = date.today().year

        FINANCE_CATEGORIES = ['Exact Match', 'AI Match', 'Manual Review',
                      'ERP Unmatched' if report_side == 'erp' else 'Physical Unmatched',
                      'Duplicate']

        all_records = ReconciliationRecord.query.filter(
            ReconciliationRecord.reconciliation_id == reconciliation_id,
            ReconciliationRecord.match_category.in_(FINANCE_CATEGORIES)
        ).all()
        all_records = [
            rec for rec in all_records
            if rec.match_category != 'Duplicate' or any(
                str(key).startswith('internal_' if report_side == 'erp' else 'customer_')
                for key in (rec.full_record_json or {})
            )
        ]

        STATUSES = ['reconciled', 'unreconciled', 'pending',
                    'exist_in_erp_not_physical' if report_side == 'erp' else 'surplus_assets',
                    'duplicated', 'unique']
        BUCKET_ORDER = ['< 1 yr','1 – 3 yr','3 – 5 yr',
                        '5 – 10 yr','10 – 20 yr','> 20 yr','Unknown']

        def _pick(j, *keys):
            for k in keys:
                v = j.get(k)
                if v and str(v).strip() not in ('', 'nan', 'None'):
                    return str(v).strip()
            return None

        def _bucket(raw_year):
            try:
                age = current_year - int(float(str(raw_year).strip()))
                if age < 1:   return '< 1 yr'
                if age < 4:   return '1 – 3 yr'
                if age < 6:   return '3 – 5 yr'
                if age < 11:  return '5 – 10 yr'
                if age < 21:  return '10 – 20 yr'
                return '> 20 yr'
            except (ValueError, TypeError):
                return 'Unknown'

        def _empty_status():
            return {s: 0 for s in STATUSES}

        # ── aging by approval status ───────────────────────────────────────────
        aging = {b: _empty_status() for b in BUCKET_ORDER}
        for rec in all_records:
            j = rec.full_record_json or {}
            year_prefix = 'internal_' if report_side == 'erp' else 'customer_'
            raw_yr = _pick(j, f'{year_prefix}year', f'{year_prefix}Year')
            bucket = _bucket(raw_yr)
            status = rec.approval_status or 'pending'
            aging[bucket][status] = aging[bucket].get(status, 0) + 1

        aging_chart = []
        for b in BUCKET_ORDER:
            row = {'bucket': b}
            row.update(aging[b])
            row['total'] = sum(aging[b].values())
            if row['total'] > 0:
                aging_chart.append(row)

        # ── department breakdown with approval stacks ──────────────────────────
        dept_map = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dept_prefix = 'internal_' if report_side == 'erp' else 'customer_'
            dept = _pick(j, f'{dept_prefix}department', 'department') or 'Unknown'
            if dept not in dept_map: dept_map[dept] = _empty_status()
            status = rec.approval_status or 'pending'
            dept_map[dept][status] = dept_map[dept].get(status, 0) + 1

        dept_chart = sorted([
            dict({'name': k[:25] + '…' if len(k) > 25 else k, 'full_name': k}, **v,
                 total=sum(v.values()))
            for k, v in dept_map.items()
        ], key=lambda x: -x['total'])[:15]

        # ── district/branch breakdown with approval stacks ─────────────────────
        dist_map = {}
        for rec in all_records:
            j = rec.full_record_json or {}
            dist_prefix = 'internal_' if report_side == 'erp' else 'customer_'
            dist = _pick(j, f'{dist_prefix}district', 'district') or 'Unknown'
            if dist not in dist_map: dist_map[dist] = _empty_status()
            status = rec.approval_status or 'pending'
            dist_map[dist][status] = dist_map[dist].get(status, 0) + 1

        dist_chart = sorted([
            dict({'name': k[:20] + '…' if len(k) > 20 else k, 'full_name': k}, **v,
                 total=sum(v.values()))
            for k, v in dist_map.items()
        ], key=lambda x: -x['total'])[:15]

        return jsonify({
            'current_year':      current_year,
            'total_records':     len(all_records),
            'aging_chart':       aging_chart,
            'department_chart':  dept_chart,
            'district_chart':    dist_chart,
            'statuses':          STATUSES,
            'side':              report_side,
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ── Admin trash and recovery ──────────────────────────────────────────────────
@reconciliation_bp.route('/<int:reconciliation_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_reconciliation(reconciliation_id):
    """
    Move a reconciliation to the admin trash without deleting its data.
    """
    try:
        user_id   = int(get_jwt_identity())
        user_role = get_user_role()

        recon = Reconciliation.query.get(reconciliation_id)
        if not recon or recon.is_deleted:
            return jsonify({'error': 'Reconciliation not found'}), 404

        recon.is_deleted = True
        recon.deleted_at = datetime.utcnow()
        recon.deleted_by = user_id
        db.session.commit()

        AuditService.log_operation(
            user_id=user_id,
            operation_type='DELETE_RECONCILIATION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={
                'customer_file': recon.customer_file,
                'internal_file': recon.internal_file,
                'deleted_by_role': user_role,
                'soft_deleted': True,
            }
        )

        return jsonify({
            'message': f'Reconciliation #{reconciliation_id} moved to trash',
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@reconciliation_bp.route('/trash', methods=['GET'])
@jwt_required()
@require_role('admin')
def list_deleted_reconciliations():
    """List soft-deleted reconciliations for administrators only."""
    reconciliations = Reconciliation.query.filter_by(is_deleted=True) \
        .order_by(Reconciliation.deleted_at.desc()).all()
    return jsonify({'reconciliations': [r.to_dict() for r in reconciliations]}), 200


@reconciliation_bp.route('/<int:reconciliation_id>/recover', methods=['POST'])
@jwt_required()
@require_role('admin')
def recover_reconciliation(reconciliation_id):
    """Restore a soft-deleted reconciliation and its existing records."""
    try:
        user_id = int(get_jwt_identity())
        recon = Reconciliation.query.get(reconciliation_id)
        if not recon or not recon.is_deleted:
            return jsonify({'error': 'Deleted reconciliation not found'}), 404

        recon.is_deleted = False
        recon.deleted_at = None
        recon.deleted_by = None
        db.session.commit()

        AuditService.log_operation(
            user_id=user_id,
            operation_type='RECOVER_RECONCILIATION',
            resource_type='reconciliation',
            resource_id=reconciliation_id,
            details={'customer_file': recon.customer_file, 'internal_file': recon.internal_file}
        )
        return jsonify({'message': f'Reconciliation #{reconciliation_id} recovered'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
