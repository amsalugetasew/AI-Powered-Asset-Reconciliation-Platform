"""
AI-powered analysis service for generating insights, recommendations, and analysis
using OpenAI's GPT models or Groq's API (OpenAI-compatible).

All prompts use chain-of-thought reasoning and are restricted to business/operational
analysis only — no technical, development, or system-enhancement suggestions.
"""

import json
from openai import OpenAI
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

# ── Shared system prompt ────────────────────────────────────────────────────
# Applied to every AI call. Establishes the business-only CoT persona.
SYSTEM_PROMPT = """You are a senior asset management business analyst with deep expertise in
physical asset inventory, ERP reconciliation, Asset controls, and operational auditing.

THINKING APPROACH -- Chain-of-Thought:
Before giving your final answer, think through the data step by step:
  Step 1 -- Understand what the data shows (numbers, patterns, distributions)
  Step 2 -- Identify what is notable, unusual, or important from a business perspective
  Step 3 -- Connect observations to real-world business consequences (financial risk,
            compliance exposure, operational efficiency, audit readiness)
  Step 4 -- Draw conclusions and frame actionable business responses

STRICT SCOPE RULES -- you MUST follow these at all times:
  [ALLOWED] Answer ONLY about: asset reconciliation results, matching quality, unreconciled(unmatched)
     assets, surplus/shortage assets, departmental or branch performance, aging of
     assets, approval status, duplicates, and related operational/financial matters.
  [NOT ALLOWED] Do NOT suggest: software improvements, system enhancements, IT changes,
     database modifications, new features, code changes, API upgrades, UI/UX
     improvements, or any technical development work.
  [NOT ALLOWED] Do NOT say things like "the system should", "the application could",
     "consider adding a feature", "improve the algorithm", or anything that
     implies changing the software or technology stack.
  [REDIRECT] If the user's question touches on technical/development topics, redirect
     the response to the business/operational dimension of the question only.

Your audience is business managers, finance officers, and auditors -- not developers."""


class AIAnalysisService:
    """Service for generating AI-powered insights and analysis"""

    def __init__(self, api_key: str = None):
        """Initialize OpenAI or Groq client"""
        if not api_key:
            import os
            api_key = os.getenv('OPENAI_API_KEY')

        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")

        if api_key.startswith('gsk_'):
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1"
            )
            self.model = "llama-3.1-8b-instant"
            self.is_groq = True
            logger.info("Using Groq API for AI analysis (llama-3.1-8b-instant)")
        else:
            self.client = OpenAI(api_key=api_key)
            self.model = "gpt-3.5-turbo"
            self.is_groq = False
            logger.info("Using OpenAI API for AI analysis")

    def _call(self, user_prompt: str, max_tokens: int = 1500) -> Dict[str, Any]:
        """Central call wrapper — always injects the business-only CoT system prompt."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=max_tokens
        )
        return response

    # ── Chart Analysis ──────────────────────────────────────────────────────

    def analyze_chart_data(
        self,
        chart_data: Dict[str, Any],
        chart_type: str,
        analysis_type: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate AI analysis for chart data using CoT prompting."""
        try:
            prompt = self._build_prompt(chart_data, chart_type, analysis_type, kwargs)
            response = self._call(prompt)
            return {
                "success": True,
                "analysis_type": analysis_type,
                "content": response.choices[0].message.content,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error in AI analysis: {str(e)}")
            return {"success": False, "error": str(e), "analysis_type": analysis_type}

    def _build_prompt(
        self,
        chart_data: Dict[str, Any],
        chart_type: str,
        analysis_type: str,
        context: Dict[str, Any]
    ) -> str:
        chart_json   = json.dumps(chart_data,  indent=2)
        context_json = json.dumps(context,     indent=2, default=str)
        dispatch = {
            "trend":       self._trend_prompt,
            "comparative": self._comparative_prompt,
            "anomaly":     self._anomaly_prompt,
            "summary":     self._summary_prompt,
        }
        fn = dispatch.get(analysis_type, self._summary_prompt)
        return fn(chart_json, chart_type, context_json)

    def _cot_header(self, chart_json, chart_type, context_json):
        """Shared chain-of-thought header injected into every analysis prompt."""
        return f"""You are analyzing a {chart_type} chart from an asset reconciliation system.

THINK STEP BY STEP before writing your answer:
  • Step 1: Read the data carefully — what do the numbers actually show?
  • Step 2: What patterns, concentrations, or imbalances stand out?
  • Step 3: What does this mean for the organization operationally and financially?
  • Step 4: What should decision-makers know or do?

IMPORTANT: Your response must focus entirely on asset management, business and operational findings.
Do NOT mention software, technology, development, system features, or IT improvements.

Chart Data:
{chart_json}

Operational Context:
{context_json}
"""

    def _trend_prompt(self, chart_json: str, chart_type: str, context_json: str) -> str:
        return self._cot_header(chart_json, chart_type, context_json) + """
Now provide your Trend Analysis covering:
1. What direction is the data moving? (growth, decline, stable)
2. Where are the most significant changes, and by how much?
3. What operational or financial factors are likely driving these trends?
4. Which departments, branches, or asset categories are most affected?
5. What should management prioritize based on these trends?

Support with visualization like any an intreactive charts

Use specific numbers and percentages. Keep the focus on operational impact."""

    def _comparative_prompt(self, chart_json: str, chart_type: str, context_json: str) -> str:
        return self._cot_header(chart_json, chart_type, context_json) + """
Now provide your Comparative Analysis covering:
1. Which categories/departments/branches are performing best vs worst?
2. What is the gap between the highest and lowest performers?
3. What does the distribution tell us about reconciliation quality across the organization?
4. Are there outliers that need urgent management attention?
5. What actions should be taken for the underperforming segments?

Support with visualization like any an intreactive charts

Be specific with numbers and percentages. Focus on business consequences."""

    def _anomaly_prompt(self, chart_json: str, chart_type: str, context_json: str) -> str:
        return self._cot_header(chart_json, chart_type, context_json) + """
Now provide your Anomaly & Risk Analysis covering:
1. What values or patterns are unusual or unexpected?
2. How large is the deviation from what would be expected?
3. What is the potential financial or compliance risk of each anomaly?
4. Which anomalies are most urgent for management to investigate?
5. What immediate operational steps should be taken for each finding?

Support with visualization like any an intreactive charts

Prioritize by business risk level (high / medium / low)."""

    def _summary_prompt(self, chart_json: str, chart_type: str, context_json: str) -> str:
        return self._cot_header(chart_json, chart_type, context_json) + """
Now provide your Executive Summary covering:
1. One-paragraph overall status of asset reconciliation (2–3 sentences)
2. Top 3 key business findings with supporting numbers
3. Most critical issues requiring management attention
4. Overall reconciliation health score (Excellent / Good / Fair / Poor) and why
5. Immediate next steps for the finance/operations team

Support with visualization like any an intreactive charts

Write for a senior business audience. No technical language."""

    # ── Recommendations ─────────────────────────────────────────────────────

    def get_recommendations(
        self,
        chart_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate business recommendations based on chart data using CoT."""
        try:
            chart_str   = json.dumps(chart_data,    indent=2)
            context_str = json.dumps(context or {}, indent=2)

            prompt = f"""You are reviewing asset reconciliation data to provide management recommendations.

THINK STEP BY STEP before writing:
  • Step 1: What does the data reveal about the current state of asset reconciliation?
  • Step 2: What are the most significant gaps, risks, or opportunities?
  • Step 3: What business outcomes are at stake (audit risk, asset loss, compliance, efficiency)?
  • Step 4: What specific actions would address each finding?

IMPORTANT: Recommendations must be operational and financial in nature.
Do NOT suggest software changes, IT improvements, system upgrades, or development work.

Reconciliation Data:
{chart_str}

Context:
{context_str}

Provide 3–5 numbered business recommendations. For each:
  • State the finding clearly
  • Explain the business/financial impact
  • Describe the specific operational action to take
  • Estimate the benefit if the action is completed

Write for finance managers and operations leadership."""

            response = self._call(prompt)
            return {
                "success": True,
                "recommendations": response.choices[0].message.content,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            return {"success": False, "error": str(e)}

    # ── Chat ────────────────────────────────────────────────────────────────

    def chat_query(
        self,
        prompt: str,
        chart_data: Optional[Dict[str, Any]] = None,
        chart_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Answer a user chat query with CoT reasoning and full conversation context.
        History is a list of {role, content} dicts (last 10 messages max).
        """
        try:
            chart_info   = json.dumps(chart_data or {},  indent=2)
            context_info = json.dumps(context  or {},    indent=2)
            chart_label  = chart_type or 'reconciliation data'

            # Build conversation messages with full history
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]

            # Add prior conversation turns for context follow-up
            if history:
                for turn in history[:-1]:  # exclude last (current user msg)
                    messages.append({"role": turn["role"], "content": turn["content"]})

            # Build the current user message with CoT framing
            user_msg = f"""Using the following reconciliation data as context, answer the question below.

Chart Type: {chart_label}
Data:
{chart_info}

Context:
{context_info}

THINK STEP BY STEP:
  • Step 1: What is the user actually asking about?
  • Step 2: What does the data tell us that is relevant to this question?
  • Step 3: What is the business meaning of that data?
  • Step 4: What is the clearest, most useful answer for a business user?

IMPORTANT: Stay focused on business and operational analysis only.
Do not suggest technical changes, software features, or development work.

User Question:
{prompt}

Answer concisely and directly. Use numbers from the data where relevant."""

            messages.append({"role": "user", "content": user_msg})

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1500
            )

            return {
                "success": True,
                "content": response.choices[0].message.content,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error processing chat query: {str(e)}")
            return {"success": False, "error": str(e)}

    # ── Insights ────────────────────────────────────────────────────────────

    def generate_insights(
        self,
        records: List[Dict[str, Any]],
        reconciliation_id: str
    ) -> Dict[str, Any]:
        """Generate high-level business insights from reconciliation records using CoT."""
        try:
            total_records = len(records) if records else 0

            if total_records == 0:
                summary = {
                    "total_records": 0,
                    "reconciled_count": 0,
                    "unreconciled_count": 0,
                    "reconciliation_rate": "N/A",
                }
                return {
                    "success": True,
                    "summary": summary,
                    "insights": "No records available for analysis at this time.",
                    "tokens_used": 0
                }

            reconciled   = sum(1 for r in records if r.get('approval_status') in
                               ['reconciled', 'exist_in_erp_not_physical'])
            unreconciled = sum(1 for r in records if r.get('approval_status') in
                               ['unreconciled', 'surplus_assets'])

            summary = {
                "total_records":       total_records,
                "reconciled_count":    reconciled,
                "unreconciled_count":  unreconciled,
                "reconciliation_rate": f"{(reconciled/total_records)*100:.1f}%" if total_records else "0%",
                "sample_records":      records[:5]
            }

            prompt = f"""You are conducting a business health review of an asset reconciliation cycle.

THINK STEP BY STEP:
  • Step 1: Review the reconciliation statistics below
  • Step 2: Identify what the numbers reveal about asset control quality
  • Step 3: Assess the financial and compliance exposure from unreconciled assets
  • Step 4: Determine what leadership needs to know and act on

IMPORTANT: Your insights must focus on business operations, financial risk, and audit readiness.
Do NOT mention software improvements, system changes, development work, or IT recommendations.

Reconciliation Summary:
{json.dumps(summary, indent=2, default=str)}

Provide:
1. Overall reconciliation health assessment (1 paragraph)
2. Financial/compliance risks from unreconciled or surplus assets
3. Departments or categories requiring urgent management attention
4. Key success factors visible in the data
5. 3 specific operational actions leadership should take this week

Write for a CFO or Finance Director audience."""

            response = self._call(prompt)

            return {
                "success": True,
                "summary": summary,
                "insights": response.choices[0].message.content,
                "tokens_used": response.usage.total_tokens
            }
        except Exception as e:
            logger.error(f"Error generating insights: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
