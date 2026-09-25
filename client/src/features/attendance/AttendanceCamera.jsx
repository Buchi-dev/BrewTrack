import {
  CameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RedoOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Alert, Button, Image, Space, Spin, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createAttendancePhotoBlob } from '../../utils/image.js'

const { Paragraph, Text } = Typography

function getCameraErrorMessage(error) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser does not support direct camera capture.'
  }

  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access in your browser to continue.'
  }

  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'No front camera was found on this device.'
  }

  return 'The camera could not be started. Please close other camera apps and try again.'
}

export default function AttendanceCamera({
  actionLabel,
  watermarkLines,
  onCapture,
  onContinue,
  onCancel,
  continueLabel = 'Continue',
  continueLoading = false,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraStatus, setCameraStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)
  const [captureResult, setCaptureResult] = useState(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setErrorMessage(null)
    setCaptureResult(null)
    setCameraStatus('loading')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API unavailable')
      }

      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraStatus('ready')
    } catch (error) {
      stopCamera()
      setErrorMessage(getCameraErrorMessage(error))
      setCameraStatus('error')
    }
  }, [stopCamera])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const capturePhoto = async () => {
    if (!videoRef.current) return

    setCameraStatus('capturing')
    setErrorMessage(null)

    try {
      const result = await createAttendancePhotoBlob({
        source: videoRef.current,
        watermarkLines,
        mirror: true,
      })

      stopCamera()
      setCaptureResult(result)
      setCameraStatus('preview')
      onCapture?.(result)
    } catch (error) {
      setErrorMessage(error.message)
      setCameraStatus('ready')
    }
  }

  const retakePhoto = () => {
    setCaptureResult(null)
    onCapture?.(null)
    startCamera()
  }

  const isLoading = cameraStatus === 'loading'
  const isCapturing = cameraStatus === 'capturing'
  const hasPreview = cameraStatus === 'preview' && captureResult

  return (
    <div className="attendance-camera">
      <div className={`attendance-camera-stage ${hasPreview ? 'is-preview' : ''}`}>
        {hasPreview ? (
          <Image
            src={captureResult.previewUrl}
            alt={`${actionLabel} attendance selfie preview`}
            preview={false}
            className="attendance-camera-image"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              className="attendance-camera-video"
              playsInline
              muted
              aria-label={`${actionLabel} live camera preview`}
            />
            <div className="face-guide" aria-hidden="true" />
            {cameraStatus === 'idle' && (
              <div className="attendance-camera-empty">
                <CameraOutlined />
                <Text strong>Camera is ready to start</Text>
                <Paragraph type="secondary">
                  Use the front camera to take a new attendance selfie.
                </Paragraph>
              </div>
            )}
            {isLoading && (
              <div className="attendance-camera-empty">
                <Spin />
                <Text strong>Opening camera</Text>
              </div>
            )}
          </>
        )}
      </div>

      {errorMessage && (
        <Alert
          className="camera-alert"
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
          message={errorMessage}
        />
      )}

      <Space wrap className="camera-actions">
        {onCancel && (
          <Button size="large" onClick={onCancel} disabled={continueLoading}>
            Cancel
          </Button>
        )}
        {!hasPreview && (
          <Button
            type="primary"
            size="large"
            icon={<VideoCameraOutlined />}
            loading={isLoading}
            onClick={startCamera}
          >
            Start camera
          </Button>
        )}
        {cameraStatus === 'ready' && (
          <Button
            size="large"
            type="primary"
            icon={<CameraOutlined />}
            loading={isCapturing}
            onClick={capturePhoto}
          >
            Take photo
          </Button>
        )}
        {hasPreview && (
          <>
            <Button size="large" icon={<RedoOutlined />} onClick={retakePhoto} disabled={continueLoading}>
              Retake
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              loading={continueLoading}
              onClick={() => onContinue?.(captureResult)}
            >
              {continueLabel}
            </Button>
          </>
        )}
      </Space>
    </div>
  )
}
