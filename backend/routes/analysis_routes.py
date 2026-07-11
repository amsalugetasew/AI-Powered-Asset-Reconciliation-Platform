"""
API routes for AI-powered analysis and report generation
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
import os
from datetime import datetime

from services.ai_analysis_service import AIAnalysisService
from services.report_generator import ReportGenerator, HAS_REPORTLAB, HAS_PYTHON_DOCX
from models import db, ReconciliationRecord, Reconciliation, User
from utils.rbac import get_user_role

logger = logging.getLogger(__name__)

analysis_bp = Blueprint('analysis', __name__, url_prefix='/api/analysis')

# Initialize services
try:
    ai_service = AIAnalysisService(api_key=os.getenv('OPENAI_API_KEY'))
except Exception as e:
    logger.warning(f"Failed to initialize AI service: {str(e)}")
    ai_service = None

report_generator = ReportGenerator()


def _get_reconciliation(reconciliation_id, user_id):
    """
    Role-aware reconciliation lookup.
    Officers: only their own. Managers/Admins: any reconciliation.
    Returns (reconciliation_or_None, error_tuple_or_None)
    """
    if not reconciliation_id:
        return None, None   # no ID supplied — caller decides what to do
    try:
        role = get_user_role()
    except Exception:
        role = 'officer'
    if role in ('manager', 'admin'):
        recon = Reconciliation.query.get(int(reconciliation_id))
    else:
        recon = Reconciliation.query.filter_by(
            id=int(reconciliation_id), user_id=user_id
        ).first()
    if not recon:
        return None, (jsonify({'error': 'Reconciliation not found', 'success': False}), 404)
    return recon, None


@analysis_bp.route('/chart-analysis', methods=['POST'])
@jwt_required()
def analyze_chart():
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available.'}), 503
        user_id = get_jwt_identity()
        data = request.get_json()
        required_fields = ['chart_data', 'chart_type', 'analysis_type']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            _, err = _get_reconciliation(reconciliation_id, user_id)
            if err:
                return err
        analysis_result = ai_service.analyze_chart_data(
            chart_data=data['chart_data'],
            chart_type=data['chart_type'],
            analysis_type=data['analysis_type'],
            reconciliation_id=reconciliation_id
        )
        return jsonify(analysis_result), 200
    except Exception as e:
        logger.error(f"Error in chart analysis: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/recommendations', methods=['POST'])
@jwt_required()
def get_recommendations():
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available.'}), 503
        user_id = get_jwt_identity()
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            _, err = _get_reconciliation(reconciliation_id, user_id)
            if err:
                return err
        recommendations = ai_service.get_recommendations(
            chart_data=data.get('chart_data'),
            context=data.get('context')
        )
        return jsonify(recommendations), 200
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/chat', methods=['POST'])
@jwt_required()
def chat():
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available.'}), 503
        user_id = get_jwt_identity()
        data = request.get_json()
        prompt_text = data.get('prompt')
        if not prompt_text:
            return jsonify({'error': 'Missing prompt text'}), 400
        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            _, err = _get_reconciliation(reconciliation_id, user_id)
            if err:
                return err
        chat_response = ai_service.chat_query(
            prompt=prompt_text,
            chart_data=data.get('chart_data'),
            chart_type=data.get('chart_type'),
            context=data.get('context'),
            history=data.get('history', [])
        )
        return jsonify(chat_response), 200
    except Exception as e:
        logger.error(f"Error processing chat request: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/insights', methods=['POST'])
@jwt_required()
def get_insights():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        logger.info(f"Insights request for reconciliation {reconciliation_id}, user {user_id}")

        reconciliation, err = _get_reconciliation(reconciliation_id, user_id)
        if err:
            return err

        # Get records
        try:
            records = ReconciliationRecord.query.filter_by(
                reconciliation_id=reconciliation_id
            ).limit(100).all()
        except Exception as db_error:
            logger.error(f"DB error fetching records: {str(db_error)}", exc_info=True)
            records = []

        if not records:
            stats = reconciliation.to_dict().get('statistics', {}) if reconciliation else {}
            summary = {
                "total_records": stats.get('total_customer_records', 0),
                "reconciled_count": stats.get('rule_matched', 0) + stats.get('ai_matched', 0),
                "unreconciled_count": stats.get('customer_unmatched', 0),
                "reconciliation_rate": "N/A",
                "source": "reconciliation_statistics"
            }
            if ai_service:
                try:
                    insights = ai_service.generate_insights([], reconciliation_id)
                    if insights.get('success'):
                        insights['summary'] = summary
                        return jsonify(insights), 200
                    return jsonify({'success': False, 'error': insights.get('error', 'Failed'), 'summary': summary}), 500
                except Exception as ai_error:
                    return jsonify({'success': False, 'error': str(ai_error), 'summary': summary}), 500
            return jsonify({'success': False, 'error': 'AI service not available', 'summary': summary}), 503

        records_data = []
        for r in records:
            try:
                records_data.append({
                    'id': r.id,
                    'match_category': getattr(r, 'match_category', 'Unknown'),
                    'approval_status': getattr(r, 'approval_status', 'pending') or 'pending',
                    'match_method': getattr(r, 'match_method', 'Unknown'),
                    'confidence_score': getattr(r, 'confidence_score', None),
                    'customer_old_tag': getattr(r, 'customer_old_tag', None),
                    'internal_old_tag': getattr(r, 'internal_old_tag', None)
                })
            except Exception as record_error:
                logger.error(f"Error converting record: {str(record_error)}")

        if not ai_service:
            return jsonify({'success': False, 'error': 'AI service not available'}), 503

        insights = ai_service.generate_insights(records_data, reconciliation_id)
        return jsonify(insights), 200

    except Exception as e:
        logger.error(f"Error in insights endpoint: {str(e)}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@analysis_bp.route('/generate-report', methods=['POST'])
@jwt_required()
def generate_report():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        format_type = data.get('format', 'excel').lower()

        if format_type not in ['excel', 'pdf', 'word']:
            return jsonify({'error': 'Invalid format. Use excel, pdf, or word'}), 400
        if format_type == 'pdf' and not HAS_REPORTLAB:
            return jsonify({'error': 'PDF generation not available. Install reportlab.'}), 503
        if format_type == 'word' and not HAS_PYTHON_DOCX:
            return jsonify({'error': 'Word generation not available. Install python-docx.'}), 503

        reconciliation = None
        if reconciliation_id:
            reconciliation, err = _get_reconciliation(reconciliation_id, user_id)
            if err:
                return err

        records = None
        if data.get('include_records') and reconciliation_id:
            record_objs = ReconciliationRecord.query.filter_by(
                reconciliation_id=reconciliation_id
            ).limit(100).all()
            records = [
                {
                    'Tag': getattr(r, 'customer_old_tag', None) or getattr(r, 'internal_old_tag', None),
                    'Status': getattr(r, 'approval_status', 'pending') or 'pending',
                    'Score': f"{getattr(r, 'confidence_score', 0):.2f}" if getattr(r, 'confidence_score', None) else "N/A",
                    'Updated': r.updated_at.strftime('%Y-%m-%d') if getattr(r, 'updated_at', None) else "N/A"
                }
                for r in record_objs
            ]

        title = data.get('title', f'Asset Reconciliation Report - {datetime.now().strftime("%Y-%m-%d")}')
        filename = f"reconciliation_report_{reconciliation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format_type}"

        report_output = report_generator.generate_report(
            format_type=format_type,
            filename=filename,
            title=title,
            summary_data=data.get('summary_data', {}),
            analysis_results=data.get('analysis_results', {}),
            records=records
        )

        mime_types = {
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf',
            'word': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        report_output.seek(0)
        return send_file(report_output, mimetype=mime_types[format_type],
                         as_attachment=True, download_name=filename)

    except Exception as e:
        logger.error(f"Error generating report: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/batch-analysis', methods=['POST'])
@jwt_required()
def batch_analysis():
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available.'}), 503
        user_id = get_jwt_identity()
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            _, err = _get_reconciliation(reconciliation_id, user_id)
            if err:
                return err
        analysis_types = data.get('analysis_types', ['summary'])
        results = {}
        for analysis_type in analysis_types:
            result = ai_service.analyze_chart_data(
                chart_data=data.get('chart_data'),
                chart_type=data.get('chart_type'),
                analysis_type=analysis_type,
                reconciliation_id=reconciliation_id
            )
            results[analysis_type] = result
        return jsonify({'success': True, 'analyses': results}), 200
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
