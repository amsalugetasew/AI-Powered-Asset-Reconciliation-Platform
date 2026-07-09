"""
AI-powered analysis service for generating insights, recommendations, and analysis
using OpenAI's GPT models or Groq's API (OpenAI-compatible).
"""

import json
from openai import OpenAI
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class AIAnalysisService:
    """Service for generating AI-powered insights and analysis"""
    
    def __init__(self, api_key: str = None):
        """Initialize OpenAI or Groq client"""
        if not api_key:
            import os
            api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
        # Detect if it's a Groq key (starts with 'gsk_')
        if api_key.startswith('gsk_'):
            # Use Groq API with OpenAI-compatible client
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1"
            )
            self.model = "llama-3.1-8b-instant"  # Fast, free, currently available
            self.is_groq = True
            logger.info("Using Groq API for AI analysis (llama-3.1-8b-instant)")
        else:
            # Use OpenAI API
            self.client = OpenAI(api_key=api_key)
            self.model = "gpt-3.5-turbo"
            self.is_groq = False
            logger.info("Using OpenAI API for AI analysis")
    
    def analyze_chart_data(
        self,
        chart_data: Dict[str, Any],
        chart_type: str,
        analysis_type: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate AI analysis for chart data
        
        Args:
            chart_data: Dictionary containing chart values and labels
            chart_type: Type of chart (pie, bar, line, etc.)
            analysis_type: Type of analysis (trend, comparative, anomaly, summary)
            **kwargs: Additional context (reconciliation_id, filters, etc.)
        
        Returns:
            Dictionary with analysis results
        """
        try:
            prompt = self._build_prompt(chart_data, chart_type, analysis_type, kwargs)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert data analyst specializing in asset reconciliation and financial analysis. Provide clear, actionable insights based on the data provided."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            analysis_text = response.choices[0].message.content
            
            return {
                "success": True,
                "analysis_type": analysis_type,
                "content": analysis_text,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error in AI analysis: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "analysis_type": analysis_type
            }
    
    def get_recommendations(
        self,
        chart_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate recommendations based on chart data
        
        Args:
            chart_data: Chart data for analysis
            context: Additional context (reconciliation status, filters, etc.)
        
        Returns:
            Dictionary with recommendations
        """
        try:
            context_str = json.dumps(context or {}, indent=2)
            chart_str = json.dumps(chart_data, indent=2)
            
            prompt = f"""Analyze the following asset reconciliation data and provide 3-5 specific, actionable recommendations.

Chart Data:
{chart_str}

Context:
{context_str}

For each recommendation:
1. State the issue clearly
2. Explain the business impact
3. Suggest specific actions
4. Estimate potential impact (if quantifiable)

Format your response as numbered recommendations with clear structure."""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert asset management consultant. Provide practical, high-impact recommendations for improving asset reconciliation processes."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            recommendations = response.choices[0].message.content
            
            return {
                "success": True,
                "recommendations": recommendations,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def chat_query(
        self,
        prompt: str,
        chart_data: Optional[Dict[str, Any]] = None,
        chart_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a user chat query using chart/reconciliation context.
        """
        try:
            chart_info = json.dumps(chart_data or {}, indent=2)
            context_info = json.dumps(context or {}, indent=2)
            chart_type_info = chart_type or 'unknown'

            prompt_body = f"""You are an expert asset reconciliation assistant.
Analyze the following chart and reconciliation context, then answer the user's query clearly.

Chart Type: {chart_type_info}
Chart Data:
{chart_info}

Context:
{context_info}

User Query:
{prompt}

Respond with actionable, concise insight, recommendation, or analysis as appropriate."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert data analyst specializing in asset reconciliation, matching, and reporting. Answer the user's question based on the provided chart data and context."
                    },
                    {
                        "role": "user",
                        "content": prompt_body
                    }
                ],
                temperature=0.7,
                max_tokens=1500
            )

            answer = response.choices[0].message.content
            return {
                "success": True,
                "content": answer,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error processing chat query: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _build_prompt(
        self,
        chart_data: Dict[str, Any],
        chart_type: str,
        analysis_type: str,
        context: Dict[str, Any]
    ) -> str:
        """Build analysis prompt based on type"""
        
        chart_json = json.dumps(chart_data, indent=2)
        context_json = json.dumps(context, indent=2, default=str)
        
        prompts = {
            "trend": self._trend_analysis_prompt(chart_json, chart_type, context_json),
            "comparative": self._comparative_analysis_prompt(chart_json, chart_type, context_json),
            "anomaly": self._anomaly_detection_prompt(chart_json, chart_type, context_json),
            "summary": self._summary_observations_prompt(chart_json, chart_type, context_json)
        }
        
        return prompts.get(analysis_type, prompts["summary"])
    
    def _trend_analysis_prompt(self, chart_json: str, chart_type: str, context: str) -> str:
        return f"""Perform a trend analysis on the following {chart_type} chart data:

{chart_json}

Context:
{context}

Provide:
1. Current trends and patterns
2. Growth or decline rates (if applicable)
3. Seasonal or cyclical patterns (if visible)
4. Future projections or expectations
5. Key factors driving these trends

Use specific numbers and percentages where available. Be concise but comprehensive."""
    
    def _comparative_analysis_prompt(self, chart_json: str, chart_type: str, context: str) -> str:
        return f"""Perform a comparative analysis on the following {chart_type} chart data:

{chart_json}

Context:
{context}

Provide:
1. Comparison between categories/segments
2. Variance analysis (highest vs lowest)
3. Relative performance metrics
4. Outliers or notable differences
5. Benchmarking insights

Be specific with numbers and percentages."""
    
    def _anomaly_detection_prompt(self, chart_json: str, chart_type: str, context: str) -> str:
        return f"""Identify anomalies and outliers in the following {chart_type} chart data:

{chart_json}

Context:
{context}

Provide:
1. Unusual values or patterns
2. Outliers and their magnitude
3. Potential causes of anomalies
4. Risk assessment for identified issues
5. Recommended actions to address anomalies

Prioritize by impact/risk level."""
    
    def _summary_observations_prompt(self, chart_json: str, chart_type: str, context: str) -> str:
        return f"""Provide a comprehensive summary and key observations for the following {chart_type} chart data:

{chart_json}

Context:
{context}

Include:
1. Executive summary (2-3 sentences)
2. Key findings and metrics
3. Important observations
4. Overall data quality assessment
5. Immediate next steps

Keep observations clear and actionable."""
    
    def generate_insights(
        self,
        records: List[Dict[str, Any]],
        reconciliation_id: str
    ) -> Dict[str, Any]:
        """
        Generate high-level insights from reconciliation records
        
        Args:
            records: List of reconciliation records
            reconciliation_id: ID of the reconciliation
        
        Returns:
            Dictionary with insights
        """
        try:
            # Calculate summary statistics
            total_records = len(records) if records else 0
            
            if total_records == 0:
                # Return basic insight without API call
                summary = {
                    "total_records": 0,
                    "reconciled_count": 0,
                    "unreconciled_count": 0,
                    "reconciliation_rate": "N/A",
                }
                
                return {
                    "success": True,
                    "summary": summary,
                    "insights": "No detailed records available. Analysis based on reconciliation statistics.",
                    "tokens_used": 0
                }
            
            # Count reconciled statuses (anything that's not unreconciled, pending, or surplus)
            reconciled = sum(1 for r in records 
                           if r.get('approval_status') in ['reconciled', 'exist_in_erp_not_physical'])
            unreconciled = sum(1 for r in records 
                             if r.get('approval_status') in ['unreconciled', 'surplus_assets'])
            
            summary = {
                "total_records": total_records,
                "reconciled_count": reconciled,
                "unreconciled_count": unreconciled,
                "reconciliation_rate": f"{(reconciled/total_records)*100:.1f}%" if total_records > 0 else "0%",
                "sample_records": records[:5]  # Include sample for context
            }
            
            prompt = f"""As an asset reconciliation expert, analyze the following reconciliation summary and provide key insights:

{json.dumps(summary, indent=2, default=str)}

Provide:
1. Overall reconciliation health assessment
2. Key bottlenecks or issues
3. Success factors
4. Risk areas requiring attention
5. Recommendations for improvement

Be specific and data-driven."""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a senior asset management strategist providing insights on reconciliation processes."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            insights = response.choices[0].message.content
            
            return {
                "success": True,
                "summary": summary,
                "insights": insights,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error generating insights: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
