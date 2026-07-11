from rest_framework import serializers

from apps.audit.models import AuditEvent


class AuditActorSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)


class AuditEventSerializer(serializers.ModelSerializer):
    actor = AuditActorSerializer(read_only=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "created_at",
            "actor",
            "ip_address",
            "user_agent",
            "action",
            "resource_type",
            "resource_id",
            "resource_name",
            "request_id",
            "status",
            "error_message",
            "metadata",
        ]
        read_only_fields = fields
