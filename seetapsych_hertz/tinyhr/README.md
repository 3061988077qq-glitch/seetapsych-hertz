# TinyHR

Lightweight learning-based remote photoplethysmography (rPPG) for heart-rate estimation from facial video.

[HERTZ collection](../../README.md) · [简体中文](README_CN.md)

## Overview

TinyHR predicts a pulse waveform from a 160-frame facial-video clip and estimates heart rate from the predicted waveform through deterministic filtering and spectral analysis. The exported ONNX model contains **82,177 parameter elements** and occupies approximately **381 KiB**.

## Demonstration

[![TinyHR demonstration: facial video, predicted pulse waveform, and heart-rate estimate](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/tinyhr-demo.gif)](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/demo-full.mp4)

The demonstration presents the detected face, predicted rPPG waveform, and heart-rate estimate together. It illustrates the processing pipeline; reported accuracy is described below.

## Training Data

TinyHR was trained on subsets of four rPPG datasets. The counts below describe the training data reported in the technical report; they are not the full sizes of the source datasets.

| Dataset | Training subjects | Training videos | Usage |
|---|---:|---:|---|
| VIPL-HR V1 | 85 | 1,883 | Training |
| VIPL-HR V2 | 500 | 2,498 | Training |
| V4V | 103 | 726 | Training |
| MCD-rPPG | 600 | 1,200 | Training; front-facing videos only |
| **Total** | **1,288** | **6,307** | **Four-source training corpus** |

The VIPL-HR V1 test split contains **22 subjects and 485 videos** and was excluded from training.

| Training configuration | Setting |
|---|---|
| Batch size | 4 |
| Initial learning rate | 0.005 |
| Learning-rate scheduler | OneCycleLR |
| Input clip | 160 RGB face crops, each resized to 128 × 128 pixels |

Source: [TinyHR technical report](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-technical-report.pdf), page 1 (input) and pages 6–7 (training data and configuration).

## Model Size and Reference Inference Time

| Measurement | Result | Interpretation |
|---|---:|---|
| Exported ONNX parameters | **82,177** | Initializer-element count after export and convolution/normalization fusion; not the pre-export trainable-parameter count |
| ONNX file size | **≈ 381 KiB** | 390,150 bytes; SHA-256 matches the checksum declared in tiny-hr.yml |
| CPU inference time | **80 ms mean** | 100 inference runs on an Intel Core i9-13900KF CPU at 3.00 GHz |
| GPU inference time | **6 ms mean** | 100 inference runs on an NVIDIA H20 GPU in a server environment |
| Input observation duration | **≈ 5.3 s at 30 FPS** | Time to collect 160 valid face frames; the first result also depends on update scheduling and computation |
| Rolling update interval | **1.0 s default** | Timestamp-based update requests; approximately 30 frames per interval at 30 FPS |

**Measurement scope.** The reference values measure model inference over 100 runs on each device. They exclude video acquisition, face detection, input-window collection, and update scheduling. Runtime configuration was not recorded; the measurements are hardware- and environment-dependent and are separate from accuracy evaluation.

The streaming implementation accumulates predicted waveform segments over up to 20 s for heart-rate estimation, so a 1.0 s update interval does not imply a 1.0 s response to physiological changes.

## Architecture and Inference

[![TinyHR architecture and inference flow](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/tinyhr-flowchart.png)](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-flowchart.pdf)

| Stage | Module | Function |
|---:|---|---|
| 01 | Frame Difference Fusion Stem | Concatenates four neighboring-frame RGB differences into 12 channels and extracts features through the difference branch. |
| 02 | Spatial Patch Embedding | A frame-wise 4 × 4 convolution with stride 4 maps 32 × 32 features to a non-overlapping 8 × 8 grid with 32 channels. |
| 03 | Multi-scale Temporal Feature block | Parallel temporal-shift branches, pointwise convolutions, a temporal feed-forward network, and residual fusion integrate temporal features. |
| 04 | Waveform Predictor | Spatial pooling and two pointwise convolutions produce one rPPG sample per input frame. |
| 05 | Signal Processing | Detrending, band-pass filtering, and the dominant Welch PSD peak yield the heart-rate estimate. |

Inference uses a Butterworth band-pass filter with cutoff frequencies of 0.75 and 2.5 Hz (45–150 BPM). Within this search band, the frequency of the largest Welch PSD peak is converted to heart rate:

~~~text
Heart rate (BPM) = 60 × dominant frequency (Hz)
~~~

## Training Objectives

The technical report defines negative Pearson correlation for temporal waveform agreement, cross-entropy over 45–149 BPM frequency bins, and KL divergence between spectral-peak distributions. Their weights are 0.2, 1.0, and 1.0:

~~~text
L = 0.2 L_time + L_CE + L_KL
~~~

## Evaluation

| Dataset | Test split | Protocol | MAE |
|---|---|---|---:|
| VIPL-HR V1 | 22 subjects · 485 videos | Held out from training | **3.88 BPM** |

The reported 3.88 BPM mean absolute error characterizes this evaluation protocol; it does not establish cross-dataset generalization or clinical measurement accuracy.

## Module Configuration and Usage

Module configuration: [tiny-hr.yml](../modules/tiny-hr.yml)

| Name | Type | Default | Description |
|---|---|---:|---|
| fps | number | 30 | Sampling rate used for waveform buffering and spectral analysis; it must match the effective input frame rate. |
| interval | number | 1 | Timestamp-based interval between update requests, in seconds; distinct from observation duration and computation time. |

~~~bash
seetapsych-webui --files seetapsych_hertz/modules/tiny-hr.yml
~~~

~~~python
from seetapsych_lib.runtime.factory import Factory
from seetapsych_lib.runtime.pipeline import Pipeline

factory = Factory()
factory.load_file_modules("seetapsych_hertz/modules/tiny-hr.yml")
pipeline = Pipeline(factory, ...)
pipeline.add_attributes("face/heart_rate")
~~~

For a complete end-to-end example with visualization, see [examples/camera_heart_rate.py](https://github.com/seetapsych/seetapsych-hertz/blob/main/examples/camera_heart_rate.py).

## Resources

- [Full recorded demonstration](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/demo-full.mp4)
- [TinyHR technical report](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-technical-report.pdf)
- [Architecture diagram](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-flowchart.pdf)

