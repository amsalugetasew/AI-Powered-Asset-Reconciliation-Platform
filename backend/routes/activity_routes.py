from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, ActivityLog
import logging

activity_bp = Blueprint('activity', __name__, url_prefix='/api/activity')
logger = logging.getLogger(__name__)

@activity_bp.route('/log', methods=['POST'])
@jwt_required()
def log_activity():
    """Log a user activity (page visit or specific action)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        data = request.json
        page_visited = data.get('page_visited', '')
        action_performed = data.get('action_performed', '')
        
        new_log = ActivityLog(
            user_email=user.email,
            page_visited=page_visited,
            action_performed=action_performed
        )
        
        db.session.add(new_log)
        db.session.commit()
        
        return jsonify({'message': 'Activity logged successfully', 'log': new_log.to_dict()}), 201
        
    except Exception as e:
        logger.error(f"Error logging activity: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to log activity', 'details': str(e)}), 500

@activity_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_logs():
    """Get all activity logs"""
    try:
        logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).all()
        return jsonify({'logs': [log.to_dict() for log in logs]}), 200
    except Exception as e:
        logger.error(f"Error fetching logs: {str(e)}")
        return jsonify({'error': 'Failed to fetch logs', 'details': str(e)}), 500
