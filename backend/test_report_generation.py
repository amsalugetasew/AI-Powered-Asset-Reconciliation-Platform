"""
Test report generation to debug the 500 error
"""
import sys
import os
from io import BytesIO

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from services.report_generator import ReportGenerator

def test_report_generation():
    """Test basic report generation"""
    generator = ReportGenerator()
    
    # Test data similar to what frontend sends
    test_data = {
        'format_type': 'excel',
        'filename': 'test_report.xlsx',
        'title': 'Test AI Analysis Report',
        'summary_data': {
            'Analysis Types': 'summary, trend, comparative, anomaly',
            'Generated At': '7/9/2026, 2:30:45 PM',
            'Chart Type': 'pie'
        },
        'analysis_results': {
            'summary': '**Overall Summary**: The data shows good performance.',
            'trend': '**Trend Analysis**: Increasing pattern observed.',
            'comparative': '**Comparative**: Values are aligned.',
            'anomaly': '**Anomalies**: No major issues detected.'
        },
        'records': None
    }
    
    print("Testing report generation with:")
    print(f"- Format: {test_data['format_type']}")
    print(f"- Title: {test_data['title']}")
    print(f"- Summary keys: {list(test_data['summary_data'].keys())}")
    print(f"- Analysis keys: {list(test_data['analysis_results'].keys())}")
    print()
    
    try:
        result = generator.generate_report(
            format_type=test_data['format_type'],
            filename=test_data['filename'],
            title=test_data['title'],
            summary_data=test_data['summary_data'],
            analysis_results=test_data['analysis_results'],
            records=test_data.get('records')
        )
        
        if result:
            size = result.tell()
            result.seek(0)
            print(f"✅ SUCCESS: Report generated ({size} bytes)")
            
            # Save to file for inspection
            with open(f"/tmp/test_report.xlsx", 'wb') as f:
                f.write(result.getvalue())
            print("✅ Report saved to /tmp/test_report.xlsx")
        else:
            print("❌ FAILED: Report generation returned None")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

def test_pdf_generation():
    """Test PDF generation specifically"""
    generator = ReportGenerator()
    
    test_data = {
        'format_type': 'pdf',
        'filename': 'test_report.pdf',
        'title': 'Test AI Analysis Report - PDF',
        'summary_data': {
            'Analysis Types': 'summary, trend',
            'Generated At': '7/9/2026, 2:30:45 PM',
        },
        'analysis_results': {
            'summary': 'This is a test summary with **bold** text and *italic* text.',
            'trend': 'Trend line is going up with &special chars<>'
        }
    }
    
    print("\nTesting PDF generation...")
    
    try:
        result = generator.generate_report(
            format_type=test_data['format_type'],
            filename=test_data['filename'],
            title=test_data['title'],
            summary_data=test_data['summary_data'],
            analysis_results=test_data['analysis_results']
        )
        
        if result:
            size = result.tell()
            result.seek(0)
            print(f"✅ SUCCESS: PDF generated ({size} bytes)")
        else:
            print("❌ FAILED: PDF generation returned None")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

def test_word_generation():
    """Test Word generation specifically"""
    generator = ReportGenerator()
    
    test_data = {
        'format_type': 'word',
        'filename': 'test_report.docx',
        'title': 'Test AI Analysis Report - Word',
        'summary_data': {
            'Analysis Types': 'summary, trend',
            'Generated At': '7/9/2026, 2:30:45 PM',
        },
        'analysis_results': {
            'summary': 'This is a test summary with bold text.',
            'trend': 'Trend analysis content here'
        }
    }
    
    print("\nTesting Word generation...")
    
    try:
        result = generator.generate_report(
            format_type=test_data['format_type'],
            filename=test_data['filename'],
            title=test_data['title'],
            summary_data=test_data['summary_data'],
            analysis_results=test_data['analysis_results']
        )
        
        if result:
            size = result.tell()
            result.seek(0)
            print(f"✅ SUCCESS: Word document generated ({size} bytes)")
        else:
            print("❌ FAILED: Word generation returned None")
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_report_generation()
    test_pdf_generation()
    test_word_generation()
