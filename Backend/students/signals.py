from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import UserSessionState


@receiver(post_save, sender=User)
def create_user_session_state(sender, instance, created, **kwargs):
    if created:
        UserSessionState.objects.get_or_create(user=instance)
