from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from students.models import Student

User = get_user_model()

@receiver(post_save, sender=User)
def create_student_profile(sender, instance, created, **kwargs):
    if created:
        Student.objects.create(user=instance)