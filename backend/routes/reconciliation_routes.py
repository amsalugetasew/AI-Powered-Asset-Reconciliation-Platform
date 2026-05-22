from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import pandas as pd
import json

from models import db, Reconciliation, ReconciliationRecord
from services.reconciliation_service import ReconciliationService
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
        reconciliation.customer_duplicates = statistics['customer_duplicates']
        reconciliation.internal_duplicates = statistics['internal_duplicates']
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
    """List all reconciliations for current user"""
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        
        reconciliations = Reconciliation.query.filter_by(user_id=user_id)\
            .order_by(Reconciliation.created_at.desc()).all()
        
        return jsonify({
            'reconciliations': [r.to_dict() for r in reconciliations]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def get_reconciliation(reconciliation_id):
    """Get specific reconciliation details"""
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        
        reconciliation = Reconciliation.query.filter_by(
            id=reconciliation_id,
            user_id=user_id
        ).first()
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        return jsonify({
            'reconciliation': reconciliation.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/download/<int:reconciliation_id>', methods=['GET'])
@jwt_required()
def download_report(reconciliation_id):
    """Download reconciliation report"""
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        
        reconciliation = Reconciliation.query.filter_by(
            id=reconciliation_id,
            user_id=user_id
        ).first()
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
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
    """Get analytics for all user reconciliations"""
    try:
        user_id = int(get_jwt_identity())  # Convert to int
        
        reconciliations = Reconciliation.query.filter_by(
            user_id=user_id,
            status='completed'
        ).all()
        
        if not reconciliations:
            return jsonify({
                'total_reconciliations': 0,
                'total_records_processed': 0,
                'total_matches': 0,
                'average_match_rate': 0,
                'by_department': {},
                'confidence_distribution': {}
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
            'average_match_rate': round(avg_match_rate, 2)
        }
        
        return jsonify(analytics), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reconciliation_bp.route('/record/<int:reconciliation_id>', methods=['POST'])
@jwt_required()
def record_results(reconciliation_id):
    """Parse the Excel report and save records to the database"""
    try:
        user_id = int(get_jwt_identity())
        
        reconciliation = Reconciliation.query.filter_by(
            id=reconciliation_id,
            user_id=user_id
        ).first()
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
            
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

