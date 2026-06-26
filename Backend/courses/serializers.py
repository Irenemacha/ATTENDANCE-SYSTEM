from rest_framework import serializers
from .models import Course, Subject, LecturerSubject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'course', 'name']


class CourseSerializer(serializers.ModelSerializer):
    subjects = SubjectSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'name', 'code', 'created_at', 'subjects']


class LecturerSubjectSerializer(serializers.ModelSerializer):
    lecturer_username = serializers.CharField(
        source='lecturer.username',
        read_only=True
    )
    subject_name = serializers.CharField(
        source='subject.name',
        read_only=True
    )

    class Meta:
        model = LecturerSubject
        fields = [
            'id',
            'lecturer',
            'lecturer_username',
            'subject',
            'subject_name'
        ]