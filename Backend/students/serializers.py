from rest_framework import serializers
from .models import Student


class StudentSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(
        source='course.name',
        read_only=True
    )

    class Meta:
        model = Student
        fields = [
            'id',
            'reg_number',
            'full_name',
            'email',
            'phone_number',
            'course',
            'course_name',
            'year_of_study',
        ]
        read_only_fields = ['id']