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

@reconciliation_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """
    Get analytics based on user role.
    
    Officers: Analytics for their own reconciliations only
    Managers/Admins: System-wide analytics
    """
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        user_role = get_user_role()
        
        # Role-based filtering
        if user_role in ['manager', 'admin']:
            # Managers and admins see system-wide analytics
            reconciliations = Reconciliation.query.filter_by(status='completed').all()
            scope = 'all'
        else:
            # Officers see only their own
            reconciliations = Reconciliation.query.filter_by(
                user_id=user_id,
                status='completed'
            ).all()
            scope = 'own'
        
        if not reconciliations:
            return jsonify({
                'total_reconciliations': 0,
                'total_records_processed': 0,
                'total_matches': 0,
                'average_match_rate': 0,
                'scope': scope,
                'role': user_role
            }), 200
        
        # Calculate aggregate statistics
        total_customer = sum(r.total_customer_records for r in reconciliations)
        total_internal = sum(r.total_internal_records for r in reconciliations)
        total_rule_matched = sum(r.rule_matched for r in reconciliations)
        total_ai_matched = sum(r.ai_matched for r in reconciliations)
        total_manual = sum(r.manual_review for r in reconciliations)
        
        total_matches = total_rule_matched + total_ai_matched
        avg_match_rate = (total_matches / total_customer * 100) if total_customer > 0 else 0
        
        analytics = {
            'total_reconciliations': len(reconciliations),
            'total_customer_records': total_customer,
            'total_internal_records': total_internal,
            'total_rule_matched': total_rule_matched,
            'total_ai_matched': total_ai_matched,
            'total_manual_review': total_manual,
            'average_match_rate': round(avg_match_rate, 2),
            'scope': scope,
            'role': user_role
        }
        
        return jsonify(analytics), 200
        
    except Exception as e:
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
        
        if approval_decision not in ['reconciled', 'not_reconciled']:
            return jsonify({
                'error': 'Invalid approval_decision',
                'allowed': ['reconciled', 'not_reconciled']
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
                    'not_reconciled': 0
                }
            summary[match_category]['total'] += count
            summary[match_category][approval_status] += count
        
        # Group unmatched categories
        if 'Customer Unmatched' in summary or 'Finance Unmatched' in summary:
            unmatched_summary = {
                'total': 0,
                'pending': 0,
                'reconciled': 0,
                'not_reconciled': 0
            }
            for key in ['Customer Unmatched', 'Finance Unmatched']:
                if key in summary:
                    unmatched_summary['total'] += summary[key]['total']
                    unmatched_summary['pending'] += summary[key]['pending']
                    unmatched_summary['reconciled'] += summary[key]['reconciled']
                    unmatched_summary['not_reconciled'] += summary[key]['not_reconciled']
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
        
        print(f"\n=== DEBUG GET_RECORDS ===")
        print(f"Reconciliation ID: {reconciliation_id}")
        print(f"Category filter: '{category}'")
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
            
            records.append({
                'id': record.id,
                'category': record.match_category,
                'customer_tag': record.customer_new_tag or record.customer_old_tag or json_data.get('New Tag') or json_data.get('Old Tag') or '-',
                'internal_tag': record.internal_new_tag or record.internal_old_tag or '-',
                'description': record.customer_description or record.internal_description or json_data.get('Description') or '-',
                'match_method': record.match_method or record.match_type or '-',
                'confidence': f"{record.confidence_score:.0%}" if record.confidence_score else '-',
                'status': 'Matched' if record.match_category in ['Exact Match', 'AI Match'] else 
                         'Review Required' if record.match_category == 'Manual Review' else 'Unmatched',
                'approval_status': approval_status,
                'approved_by': approver_name,
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

