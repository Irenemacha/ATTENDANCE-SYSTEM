from django.core.management.base import BaseCommand
from attendance.views import auto_close_expired_sessions


class Command(BaseCommand):
    help = "Automatically close expired attendance sessions and update attendance."

    def handle(self, *args, **options):
        auto_close_expired_sessions()

        self.stdout.write(
            self.style.SUCCESS(
                "Expired attendance sessions processed successfully."
            )
        )