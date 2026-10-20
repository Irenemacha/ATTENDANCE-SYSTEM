from django.urls import path
from .views import start_session
from .views import (
    start_session,
    check_in,
    check_out,
    end_session,
    lecturer_dashboard,
    attendance_report,
    admin_report,
    session_report,
    active_session,
    location_update
)
from .views import session_history, session_history_detail
from .views import lecturer_students, lecturer_scope
from .hod_views import hod_dashboard, hod_students, hod_report, hod_courses

urlpatterns = [
    # Lecturer session control
    path('start-session/', start_session, name='start_session'),
    path('start/', start_session, name='attendance_start'),
    path('end-session/', end_session, name='end_session'),
    path('end/', end_session, name='attendance_end'),


    # Student attendance
    path('check-in/', check_in, name='check_in'),
    path('check-out/', check_out, name='check_out'),
    path('active-session/', active_session, name='active_session'),
    path('location-update/', location_update, name='location-update'),

    # Lecturer dashboard
    path('lecturer/dashboard/', lecturer_dashboard, name='lecturer_dashboard'),
    path('lecturer/students/', lecturer_students, name='lecturer_students'),
    path('lecturer/scope/', lecturer_scope, name='lecturer_scope'),
    path('report/', attendance_report, name='attendance_report'),
    path('admin-report/', admin_report, name='admin_report'),
    path('session-report/<int:session_id>/', session_report, name='session_report'),

    # HOD (department scoped)
    path('hod/dashboard/', hod_dashboard, name='hod_dashboard'),
    path('hod/students/', hod_students, name='hod_students'),
    path('hod/report/', hod_report, name='hod_report'),
    path('hod/courses/', hod_courses, name='hod_courses'),

    # Session change history
    path('session-history/', session_history, name='session_history'),
    path('session-history/<int:session_id>/', session_history_detail, name='session_history_detail'),
]


