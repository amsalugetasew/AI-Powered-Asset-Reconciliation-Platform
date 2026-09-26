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


@activity_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    """
    Return role-based notifications derived from live database data.
    Officers  → their own reconciliations: completions + pending approvals
    Managers  → all reconciliations: pending approvals + recent completions
    Admins    → same as manager + failed jobs
    All statuses are computed fresh every call (no separate notification table needed).
    """
    try:
        from models import Reconciliation, ReconciliationRecord
        from utils.rbac import get_user_role
        from datetime import datetime, timedelta

        user_id   = int(get_jwt_identity())
        user_role = get_user_role()
        notifications = []

        # ── helper to build a notification dict ───────────────────────────
        def notif(nid, ntype, title, message, link=None, severity='info'):
            return {
                'id':       nid,
                'type':     ntype,
                'title':    title,
                'message':  message,
                'link':     link,
                'severity': severity,   # info | warning | error | success
            }

        # ── fetch relevant reconciliations ────────────────────────────────
        if user_role in ['manager', 'admin']:
            recons = Reconciliation.query.filter_by(is_deleted=False).order_by(
                Reconciliation.created_at.desc()).limit(100).all()
        else:
            recons = Reconciliation.query.filter(
                Reconciliation.is_deleted.is_(False),
                db.or_(
                    Reconciliation.user_id == user_id,
                    Reconciliation.assigned_to == user_id,
                    Reconciliation.assignment_scope == 'all_officers'
                )
            ).order_by(
                Reconciliation.created_at.desc()
            ).limit(100).all()

        for r in recons:
            # Active checker/approver work remains until all relevant records are resolved.
            if r.status == 'completed':
                def _status_value(record, legacy_field, explicit_field):
                    return getattr(record, explicit_field, None) or getattr(record, legacy_field, None) or 'pending'

                def _is_pending_check(record):
                    status = _status_value(record, 'check_status', 'checker_status')
                    return status in [None, '', 'pending', 'checking']

                def _is_pending_approval(record):
                    status = _status_value(record, 'approval_status', 'approver_status')
                    return status in [None, '', 'pending']

                records = ReconciliationRecord.query.filter_by(reconciliation_id=r.id).all()

                check_pending_records = [rec for rec in records if _is_pending_check(rec)]
                check_pending_count = len(check_pending_records)

                if user_role == 'officer' and (r.assigned_to == user_id or r.assignment_scope == 'all_officers') and check_pending_count > 0:
                    notifications.append(notif(
                        nid=f'pending-check-{r.id}',
                        ntype='pending_check',
                        title=f'Pending Check — #{r.id}',
                        message=f'{check_pending_count} assigned records still need your review.',
                        link=f'/approval/{r.id}',
                        severity='warning'
                    ))

                approval_pending_records = [
                    rec for rec in records
                    if _is_pending_approval(rec)
                    and (
                        _status_value(rec, 'check_status', 'checker_status') not in [None, '', 'pending', 'checking']
                        or user_role in ['manager', 'admin']
                    )
                ]
                approval_pending_count = len(approval_pending_records)

                if user_role in ['manager', 'admin']:
                    approval_target = True
                elif user_role == 'officer':
                    approval_target = (r.user_id == user_id or r.assigned_to == user_id or r.assignment_scope == 'all_officers')
                else:
                    approval_target = False

                if approval_target and approval_pending_count > 0:
                    who = 'your' if r.user_id == user_id else ('your assigned reconciliation' if r.assigned_to == user_id else f"Reconciliation #{r.id}")
                    notifications.append(notif(
                        nid=f'pending-approval-{r.id}',
                        ntype='pending_approval',
                        title=f'Pending Approval — #{r.id}',
                        message=f'{approval_pending_count} records are ready for approval in {who}.',
                        link=f'/approval/{r.id}',
                        severity='warning'
                    ))

                # Recently completed (within last 24h) — success notification
                if r.completed_at:
                    age = datetime.utcnow() - r.completed_at
                    if age <= timedelta(hours=24) and r.user_id == user_id:
                        notifications.append(notif(
                            nid=f'completed-{r.id}',
                            ntype='completed',
                            title=f'Reconciliation #{r.id} Completed',
                            message=f'Processing finished. {r.rule_matched + r.ai_matched} records matched out of {r.total_customer_records}.',
                            link=f'/results/{r.id}',
                            severity='success'
                        ))

            # Failed jobs
            if r.status == 'failed' and r.user_id == user_id:
                notifications.append(notif(
                    nid=f'failed-{r.id}',
                    ntype='failed',
                    title=f'Reconciliation #{r.id} Failed',
                    message='Processing failed. Please re-upload and try again.',
                    link='/',
                    severity='error'
                ))

        # ── Admin extra: users created in last 7 days ─────────────────────
        if user_role == 'admin':
            from models import User as UserModel
            new_users = UserModel.query.filter(
                UserModel.created_at >= datetime.utcnow() - timedelta(days=7)
            ).all()
            if new_users:
                notifications.append(notif(
                    nid='new-users',
                    ntype='admin',
                    title=f'{len(new_users)} New User(s) This Week',
                    message=', '.join(u.username for u in new_users[:5]),
                    link='/users',
                    severity='info'
                ))

        return jsonify({
            'notifications': notifications,
            'unread_count':  len(notifications)
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@activity_bp.route('/notifications/dismiss', methods=['POST'])
@jwt_required()
def dismiss_notification():
    """
    Client-side dismissal — the frontend maintains dismissed IDs in localStorage.
    This endpoint just returns success so we can keep the pattern consistent.
    """
    return jsonify({'success': True}), 200
