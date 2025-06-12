from rest_framework import serializers

class TranscribeInputSerializer(serializers.Serializer):
    audio_file = serializers.FileField(required=True)
    model = serializers.ChoiceField(choices=['whisper', 'wav2vec2'], default='whisper')
