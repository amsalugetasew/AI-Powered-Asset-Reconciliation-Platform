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

logger = logging.getLogger(__name__)

analysis_bp = Blueprint('analysis', __name__, url_prefix='/api/analysis')

# Initialize services
try:
    ai_service = AIAnalysisService(api_key=os.getenv('OPENAI_API_KEY'))
except Exception as e:
    logger.warning(f"Failed to initialize AI service: {str(e)}")
    ai_service = None

report_generator = ReportGenerator()


@analysis_bp.route('/chart-analysis', methods=['POST'])
@jwt_required()
def analyze_chart():
    """
    Analyze chart data and generate insights
    
    Request body:
    {
        "reconciliation_id": "str",
        "chart_data": {...},
        "chart_type": "pie|bar|line",
        "analysis_type": "trend|comparative|anomaly|summary"
    }
    """
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available. Please check OPENAI_API_KEY configuration.'}), 503
        
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate input
        required_fields = ['chart_data', 'chart_type', 'analysis_type']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            reconciliation = Reconciliation.query.filter_by(
                id=reconciliation_id,
                user_id=user_id
            ).first()
            
            if not reconciliation:
                return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Get analysis
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
    """
    Generate recommendations based on chart data
    
    Request body:
    {
        "reconciliation_id": "str",
        "chart_data": {...},
        "context": {...}
    }
    """
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available. Please check OPENAI_API_KEY configuration.'}), 503
        
        user_id = get_jwt_identity()
        data = request.get_json()
        
        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            reconciliation = Reconciliation.query.filter_by(
                id=reconciliation_id,
                user_id=user_id
            ).first()
            
            if not reconciliation:
                return jsonify({'error': 'Reconciliation not found'}), 404
        
        # Get recommendations
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
    """
    Chat with AI using current chart or reconciliation context

    Request body:
    {
        "reconciliation_id": "str",
        "chart_data": {...},
        "chart_type": "pie|bar|line|table",
        "prompt": "str",
        "context": {...}
    }
    """
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available. Please check OPENAI_API_KEY configuration.'}), 503

        user_id = get_jwt_identity()
        data = request.get_json()
        prompt_text = data.get('prompt')
        if not prompt_text:
            return jsonify({'error': 'Missing prompt text'}), 400

        reconciliation_id = data.get('reconciliation_id')
        if reconciliation_id:
            reconciliation = Reconciliation.query.filter_by(
                id=reconciliation_id,
                user_id=user_id
            ).first()

            if not reconciliation:
                return jsonify({'error': 'Reconciliation not found'}), 404

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
    """
    Generate insights from reconciliation records
    
    Request body:
    {
        "reconciliation_id": "str"
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        reconciliation_id = data.get('reconciliation_id')
        
        logger.info(f"Insights request for reconciliation {reconciliation_id}, user {user_id}")
        
        # Verify user access
        reconciliation = Reconciliation.query.filter_by(
            id=reconciliation_id,
            user_id=user_id
        ).first()
        
        if not reconciliation:
            logger.warning(f"Reconciliation {reconciliation_id} not found for user {user_id}")
            return jsonify({'error': 'Reconciliation not found', 'success': False}), 404
        
        logger.info(f"Found reconciliation, retrieving records...")
        
        # Get records
        try:
            records = ReconciliationRecord.query.filter_by(
                reconciliation_id=reconciliation_id
            ).limit(100).all()
            logger.info(f"Retrieved {len(records) if records else 0} records")
        except Exception as db_error:
            logger.error(f"Database error fetching records: {str(db_error)}", exc_info=True)
            records = []
        
        if not records:
            logger.warning(f"No records found in database, using reconciliation stats")
            # Return summary from reconciliation statistics
            stats = reconciliation.statistics or {}
            summary = {
                "total_records": stats.get('total_customer_records', 0),
                "reconciled_count": stats.get('rule_matched', 0) + stats.get('ai_matched', 0),
                "unreconciled_count": stats.get('customer_unmatched', 0),
                "reconciliation_rate": "N/A",
                "source": "reconciliation_statistics"
            }
            
            # Generate insights from stats
            try:
                insights = ai_service.generate_insights([], reconciliation_id)
                if insights.get('success'):
                    insights['summary'] = summary
                    return jsonify(insights), 200
                else:
                    return jsonify({
                        'success': False,
                        'error': insights.get('error', 'Failed to generate insights'),
                        'summary': summary
                    }), 500
            except Exception as ai_error:
                logger.error(f"AI service error: {str(ai_error)}", exc_info=True)
                return jsonify({
                    'success': False,
                    'error': f"AI service error: {str(ai_error)}",
                    'summary': summary
                }), 500
        
        # Convert to dictionary
        records_data = []
        for r in records:
            try:
                record_dict = {
                    'id': r.id,
                    'match_category': getattr(r, 'match_category', 'Unknown'),
                    'approval_status': getattr(r, 'approval_status', 'pending') or 'pending',
                    'match_method': getattr(r, 'match_method', 'Unknown'),
                    'confidence_score': getattr(r, 'confidence_score', None),
                    'customer_old_tag': getattr(r, 'customer_old_tag', None),
                    'internal_old_tag': getattr(r, 'internal_old_tag', None)
                }
                records_data.append(record_dict)
            except Exception as record_error:
                logger.error(f"Error converting record {getattr(r, 'id', 'Unknown')}: {str(record_error)}")
                continue
        
        logger.info(f"Converted {len(records_data)} records for analysis")
        
        # Get insights
        try:
            insights = ai_service.generate_insights(records_data, reconciliation_id)
            logger.info(f"Insights generated successfully: {insights.get('success')}")
            return jsonify(insights), 200
        except Exception as ai_error:
            logger.error(f"AI service error during insights generation: {str(ai_error)}", exc_info=True)
            return jsonify({
                'success': False,
                'error': f"AI service error: {str(ai_error)}"
            }), 500
    
    except Exception as e:
        logger.error(f"Error in insights endpoint: {str(e)}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@analysis_bp.route('/generate-report', methods=['POST'])
@jwt_required()
def generate_report():
    """
    Generate and download report
    
    Request body:
    {
        "reconciliation_id": "str",
        "format": "excel|pdf|word",
        "title": "str",
        "summary_data": {...},
        "analysis_results": {...},
        "include_records": true|false
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        reconciliation_id = data.get('reconciliation_id')
        format_type = data.get('format', 'excel').lower()
        
        if format_type not in ['excel', 'pdf', 'word']:
            return jsonify({'error': 'Invalid format. Use excel, pdf, or word'}), 400
        
        if reconciliation_id:
            reconciliation = Reconciliation.query.filter_by(
                id=reconciliation_id,
                user_id=user_id
            ).first()
            
            if not reconciliation:
                return jsonify({'error': 'Reconciliation not found'}), 404
        else:
            reconciliation = None

        # Check server capabilities for requested formats
        if format_type == 'pdf' and not HAS_REPORTLAB:
            logger.warning('PDF generation requested but reportlab is not installed')
            return jsonify({'error': 'PDF generation not available on server. Install reportlab.'}), 503
        if format_type == 'word' and not HAS_PYTHON_DOCX:
            logger.warning('Word generation requested but python-docx is not installed')
            return jsonify({'error': 'Word generation not available on server. Install python-docx.'}), 503
        
        # Get records if needed
        records = None
        if data.get('include_records'):
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
        
        # Generate report
        title = data.get('title', f'Asset Reconciliation Report - {datetime.now().strftime("%Y-%m-%d")}')
        filename = f"reconciliation_report_{reconciliation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format_type}"
        
        logger.info(f"Generating {format_type} report: {filename}")
        logger.info(f"Report data - title: {title}, summary_data keys: {list(data.get('summary_data', {}).keys())}, analysis_results keys: {list(data.get('analysis_results', {}).keys())}")
        
        try:
            report_output = report_generator.generate_report(
                format_type=format_type,
                filename=filename,
                title=title,
                summary_data=data.get('summary_data', {}),
                analysis_results=data.get('analysis_results', {}),
                records=records
            )
            logger.info(f"Report generated successfully, size: {report_output.tell()} bytes")
        except Exception as e:
            logger.error(f"Report generation failed: {str(e)}", exc_info=True)
            raise
        
        # Determine MIME type
        mime_types = {
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf',
            'word': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
        
        # Reset file pointer
        report_output.seek(0)
        
        return send_file(
            report_output,
            mimetype=mime_types.get(format_type),
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@analysis_bp.route('/batch-analysis', methods=['POST'])
@jwt_required()
def batch_analysis():
    """
    Perform multiple analyses at once
    
    Request body:
    {
        "reconciliation_id": "str",
        "chart_data": {...},
        "chart_type": "str",
        "analysis_types": ["trend", "comparative", "anomaly", "summary"]
    }
    """
    try:
        if not ai_service:
            return jsonify({'error': 'AI service not available. Please check OPENAI_API_KEY configuration.'}), 503
        
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Verify user access
        reconciliation = Reconciliation.query.filter_by(
            id=data.get('reconciliation_id'),
            user_id=user_id
        ).first()
        
        if not reconciliation:
            return jsonify({'error': 'Reconciliation not found'}), 404
        
        analysis_types = data.get('analysis_types', ['summary'])
        results = {}
        
        for analysis_type in analysis_types:
            result = ai_service.analyze_chart_data(
                chart_data=data.get('chart_data'),
                chart_type=data.get('chart_type'),
                analysis_type=analysis_type,
                reconciliation_id=data.get('reconciliation_id')
            )
            results[analysis_type] = result
        
        return jsonify({'success': True, 'analyses': results}), 200
    
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
