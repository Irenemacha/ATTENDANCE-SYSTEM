from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import AttendanceSession, Attendance

User = get_user_model()


class AttendanceSessionSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.CharField(
        source='lecturer.username',
        read_only=True
    )

    class Meta:
        model = AttendanceSession
        fields = [
            'id',
            'lecturer',
            'lecturer_name',
            'course',
            'subject',
            'is_active',
            'start_time',
            'latitude',
            'longitude',
            'radius_meters',
        ]
        read_only_fields = ['id', 'start_time']


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(
        source='student.full_name',
        read_only=True
    )

    class Meta:
        model = Attendance
        fields = [
            'id',
            'student',
            'student_name',
            'session',
            'check_in_time',
            'check_out_time',
            'status',
        ]
        read_only_fields = ['id']
