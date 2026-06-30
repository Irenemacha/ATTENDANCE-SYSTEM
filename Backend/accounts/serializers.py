from django.contrib.auth.models import User
from rest_framework import serializers



class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role']

    def get_role(self, obj):
        if obj.is_staff or obj.is_superuser:
            return "admin"
        if hasattr(obj, "student"):
            return "student"
        groups = list(obj.groups.values_list("name", flat=True))
        if groups:
            return groups[0].lower()
        return "user"
