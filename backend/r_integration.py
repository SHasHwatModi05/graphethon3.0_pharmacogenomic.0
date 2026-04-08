# r_integration.py — R subprocess runner with Python matplotlib fallback
import subprocess
import base64
import json
import os
import io
import sys
from typing import Dict, List, Optional


def is_r_available() -> bool:
    """Check if Rscript is available on the system"""
    try:
        result = subprocess.run(
            ["Rscript", "--version"],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def generate_vitals_chart_python(vitals_data: List[Dict]) -> str:
    """Fallback: generate vitals chart using matplotlib"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates
        from datetime import datetime
        
        if not vitals_data:
            return generate_empty_chart_python("No vitals data available")
        
        times = []
        hr_vals, sys_bp, dia_bp, spo2, temp = [], [], [], [], []
        
        for v in vitals_data[-20:]:  # last 20 readings
            try:
                t = datetime.fromisoformat(v.get('recorded_at', '').replace('Z', '+00:00')) if v.get('recorded_at') else datetime.utcnow()
                times.append(t)
                hr_vals.append(v.get('heart_rate') or 0)
                sys_bp.append(v.get('systolic_bp') or 0)
                dia_bp.append(v.get('diastolic_bp') or 0)
                spo2.append(v.get('oxygen_saturation') or 0)
                temp.append(v.get('temperature') or 0)
            except Exception:
                continue
        
        if not times:
            return generate_empty_chart_python("No valid vitals timestamps")
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.patch.set_facecolor('#0f1117')
        
        plot_configs = [
            (axes[0, 0], hr_vals, 'Heart Rate (bpm)', '#ef4444', 60, 100),
            (axes[0, 1], sys_bp, 'Systolic BP (mmHg)', '#3b82f6', 90, 140),
            (axes[1, 0], spo2, 'O₂ Saturation (%)', '#10b981', 95, 100),
            (axes[1, 1], temp, 'Temperature (°C)', '#f59e0b', 36, 38),
        ]
        
        for ax, data, title, color, low, high in plot_configs:
            ax.set_facecolor('#1e2030')
            ax.spines['bottom'].set_color('#374151')
            ax.spines['top'].set_color('#374151')
            ax.spines['left'].set_color('#374151')
            ax.spines['right'].set_color('#374151')
            
            if data and any(d > 0 for d in data):
                ax.plot(times, data, color=color, linewidth=2.5, marker='o', markersize=4)
                ax.fill_between(times, data, alpha=0.15, color=color)
                ax.axhline(y=high, color=color, linestyle='--', alpha=0.4, linewidth=1)
                ax.axhline(y=low, color='#6b7280', linestyle='--', alpha=0.4, linewidth=1)
            
            ax.set_title(title, color='#e5e7eb', fontsize=11, fontweight='bold', pad=10)
            ax.tick_params(colors='#9ca3af', labelsize=8)
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
            plt.setp(ax.xaxis.get_majorticklabels(), rotation=30, ha='right')
            ax.grid(True, alpha=0.15, color='#374151')
        
        plt.suptitle('Patient Vitals Dashboard', color='#f9fafb', fontsize=14, fontweight='bold', y=1.01)
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120, bbox_inches='tight',
                    facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode('utf-8')
    
    except ImportError:
        return generate_empty_chart_python("matplotlib not available")


def generate_risk_distribution_python(analyses_data: List[Dict]) -> str:
    """Generate risk distribution chart using matplotlib"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np
        
        if not analyses_data:
            return generate_empty_chart_python("No analysis data available")
        
        risk_counts = {}
        drug_risks = {}
        
        for a in analyses_data:
            risk = a.get('risk_label', 'Unknown')
            drug = a.get('drug', 'Unknown')
            risk_counts[risk] = risk_counts.get(risk, 0) + 1
            drug_risks[drug] = risk
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        fig.patch.set_facecolor('#0f1117')
        
        # Risk pie chart
        ax1 = axes[0]
        ax1.set_facecolor('#1e2030')
        
        colors = {
            'Safe': '#10b981', 'Adjust Dosage': '#f59e0b',
            'Toxic': '#ef4444', 'Ineffective': '#8b5cf6', 'Unknown': '#6b7280'
        }
        pie_colors = [colors.get(k, '#6b7280') for k in risk_counts.keys()]
        
        wedges, texts, autotexts = ax1.pie(
            list(risk_counts.values()),
            labels=list(risk_counts.keys()),
            colors=pie_colors,
            autopct='%1.0f%%',
            startangle=90,
            pctdistance=0.8
        )
        for text in texts:
            text.set_color('#e5e7eb')
            text.set_fontsize(9)
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
        ax1.set_title('Risk Distribution', color='#f9fafb', fontsize=12, fontweight='bold')
        
        # Drug risk bar chart
        ax2 = axes[1]
        ax2.set_facecolor('#1e2030')
        ax2.spines['bottom'].set_color('#374151')
        ax2.spines['top'].set_color('#374151')
        ax2.spines['left'].set_color('#374151')
        ax2.spines['right'].set_color('#374151')
        
        drugs = list(drug_risks.keys())
        bar_colors = [colors.get(drug_risks[d], '#6b7280') for d in drugs]
        x_pos = np.arange(len(drugs))
        
        bars = ax2.bar(x_pos, [1] * len(drugs), color=bar_colors, alpha=0.85, edgecolor='#374151')
        ax2.set_xticks(x_pos)
        ax2.set_xticklabels([d[:10] for d in drugs], rotation=30, ha='right', color='#9ca3af', fontsize=9)
        ax2.set_yticks([])
        
        # Add risk labels on bars
        for i, (bar, drug) in enumerate(zip(bars, drugs)):
            ax2.text(bar.get_x() + bar.get_width() / 2, 0.5,
                     drug_risks[drug], ha='center', va='center',
                     color='white', fontweight='bold', fontsize=8)
        
        ax2.set_title('Drug Risk Profile', color='#f9fafb', fontsize=12, fontweight='bold')
        ax2.tick_params(colors='#9ca3af')
        ax2.grid(axis='y', alpha=0.15, color='#374151')
        
        plt.suptitle('Pharmacogenomic Risk Dashboard', color='#f9fafb', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120, bbox_inches='tight',
                    facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode('utf-8')
    
    except ImportError:
        return generate_empty_chart_python("matplotlib not available")


def generate_empty_chart_python(message: str) -> str:
    """Return a simple placeholder base64 png"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(8, 4))
        fig.patch.set_facecolor('#1e2030')
        ax.set_facecolor('#1e2030')
        ax.text(0.5, 0.5, message, ha='center', va='center',
                color='#9ca3af', fontsize=12, transform=ax.transAxes)
        ax.set_xticks([])
        ax.set_yticks([])
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=80, bbox_inches='tight',
                    facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode('utf-8')
    except Exception:
        return ""


def generate_patient_dashboard(
    patient_data: Dict,
    vitals_data: List[Dict],
    analyses_data: List[Dict]
) -> Dict[str, str]:
    """
    Generate patient dashboard charts.
    Returns dict of chart_name -> base64_png_string
    """
    r_available = is_r_available()
    
    charts = {}
    
    if r_available:
        # Try R-based charts first using subprocess
        try:
            charts['vitals'] = run_r_vitals_chart(vitals_data)
            charts['risk'] = run_r_risk_chart(analyses_data)
            charts['method'] = 'R'
            return charts
        except Exception as e:
            print(f"R chart generation failed, falling back to Python: {e}")
    
    # Python fallback
    charts['vitals'] = generate_vitals_chart_python(vitals_data)
    charts['risk'] = generate_risk_distribution_python(analyses_data)
    charts['method'] = 'Python/matplotlib'
    
    return charts


def run_r_vitals_chart(vitals_data: List[Dict]) -> str:
    """Run R script to generate vitals chart"""
    r_script_path = os.path.join(os.path.dirname(__file__), 'r_scripts', 'vitals_chart.R')
    
    if not os.path.exists(r_script_path):
        raise FileNotFoundError("R script not found")
    
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(vitals_data, f)
        data_path = f.name
    
    out_path = data_path.replace('.json', '.png')
    
    try:
        result = subprocess.run(
            ['Rscript', r_script_path, data_path, out_path],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"R error: {result.stderr}")
        
        with open(out_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    finally:
        for path in [data_path, out_path]:
            if os.path.exists(path):
                os.unlink(path)


def run_r_risk_chart(analyses_data: List[Dict]) -> str:
    """Run R script to generate risk chart"""
    r_script_path = os.path.join(os.path.dirname(__file__), 'r_scripts', 'risk_chart.R')
    
    if not os.path.exists(r_script_path):
        raise FileNotFoundError("R script not found")
    
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(analyses_data, f)
        data_path = f.name
    
    out_path = data_path.replace('.json', '.png')
    
    try:
        result = subprocess.run(
            ['Rscript', r_script_path, data_path, out_path],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"R error: {result.stderr}")
        
        with open(out_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    finally:
        for path in [data_path, out_path]:
            if os.path.exists(path):
                os.unlink(path)
