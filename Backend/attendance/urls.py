from django.urls import path
from .views import start_session
from .views import (
    start_session,
    check_in,
    check_out,
    end_session,
    lecturer_dashboard,
    mark_attendance,
    attendance_report,
    session_report,
)

urlpatterns = [
    # Lecturer session control
    path('start-session/', start_session, name='start_session'),
    path('start/', start_session, name='attendance_start'),
    path('end-session/', end_session, name='end_session'),
    path('end/', end_session, name='attendance_end'),


    # Student attendance
    path('check-in/', check_in, name='check_in'),
    path('check-out/', check_out, name='check_out'),
    path('mark/', mark_attendance, name='mark_attendance'),

    # Lecturer dashboard
    path('lecturer/dashboard/', lecturer_dashboard, name='lecturer_dashboard'),
    path('report/', attendance_report, name='attendance_report'),
    path('session-report/<int:session_id>/', session_report, name='session_report'),
]
