from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta
from attendance.models import AttendanceSession, MovementLog
from courses.models import Classroom
from students.models import Student  # Adjust if your Student model is elsewhere

@login_required
def dashboard_home(request):
    today = timezone.now().date()
    last_7_days = today - timedelta(days=7)

    # --- Stats for the cards ---
    total_students = Student.objects.count()
    total_classrooms = Classroom.objects.count()
    active_sessions = AttendanceSession.objects.filter(is_active=True).count()
    today_logs = MovementLog.objects.filter(timestamp__date=today).count()

    # --- Data for the chart (last 7 days) ---
    chart_labels = []
    chart_data = []
    for i in range(6, -1, -1):  # Go backwards to show oldest to newest
        day = today - timedelta(days=i)
        count = AttendanceSession.objects.filter(date=day).count()
        chart_labels.append(day.strftime('%b %d'))  # e.g., "Jul 15"
        chart_data.append(count)

    # --- Recent Activity for the table ---
    recent_logs = MovementLog.objects.select_related('student', 'classroom').order_by('-timestamp')[:10]

    context = {
        'total_students': total_students,
        'total_classrooms': total_classrooms,
        'active_sessions': active_sessions,
        'today_logs': today_logs,
        'chart_labels': chart_labels,
        'chart_data': chart_data,
        'recent_logs': recent_logs,
    }
    return render(request, 'dashboard/index.html', context)