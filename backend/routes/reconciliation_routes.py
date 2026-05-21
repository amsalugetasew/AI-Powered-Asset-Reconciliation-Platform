from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime

from models import db, Reconciliation
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
