<div align="center">

# HERTZ

<img src="https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/tinyhr-logo.png" width="460" alt="HERTZ logo">

### Open-source heart-rate estimation from facial video

HERTZ brings complementary heart-rate estimators into one extensible open-source collection.
TinyHR learns pulse waveforms from facial video, while AdaChrom recovers pulse signals through
an interpretable, training-free chrominance pipeline. The collection follows a modular
organization that supports the incorporation, independent documentation, and comparison of
additional rPPG estimators.

[English](README.md) | [简体中文](README_CN.md)

[HERTZ Project Website](https://seetapsych.github.io/seetapsych-hertz/)

[Introduction](#introduction) · [Estimator collection](#hertz-estimator-collection) · [Installation](#installation) · [Module zoo](#module-zoo) · [Resources](#resources)

[![Python](https://img.shields.io/badge/Python-3.10%2B-2563D8?logo=python&logoColor=white)](https://github.com/seetapsych/seetapsych-hertz/blob/main/pyproject.toml)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-75E5C9)](https://github.com/seetapsych/seetapsych-hertz/blob/main/LICENSE)

</div>

## Introduction

HERTZ provides heart-rate estimation modules for the
[SeetaPsych](https://github.com/seetapsych/seetapsych-lib) ecosystem. It includes two
open-source remote photoplethysmography (rPPG) estimators: **TinyHR**, a lightweight
convolutional model that predicts a pulse waveform from facial video, and **AdaChrom**, an
unsupervised signal-processing method based on adaptive skin-region selection, chrominance
projection, and frequency analysis.

## HERTZ Estimator Collection

### TinyHR: lightweight learning-based rPPG

TinyHR is a compact learning-based estimator that predicts an rPPG waveform from facial video
and obtains heart rate through spectral post-processing. Its training data, architecture,
reference inference measurements, evaluation protocol, and usage example are documented in
[the TinyHR README](seetapsych_hertz/tinyhr/README.md) and
[the Chinese TinyHR README](seetapsych_hertz/tinyhr/README_CN.md).

### AdaChrom: unsupervised chrominance-based rPPG

AdaChrom is an unsupervised remote photoplethysmography method for heart-rate estimation from
facial videos. Instead of relying on labeled training data, AdaChrom estimates pulse-related
blood volume pulse (BVP) signals from subtle temporal color variations in facial skin regions,
providing an interpretable solution for contactless heart-rate estimation. Given a facial video
sequence, AdaChrom follows a three-stage
pipeline. In the pre-processing stage, face alignment is performed and ROI masks are generated.
In the BVP extraction stage, mean BGR color signals are extracted from valid facial regions over
a sliding temporal window, and the BVP signal is recovered from these temporal color signals. In
the post-processing stage, heart rate is estimated from the recovered BVP signal through
frequency-domain analysis and peak selection.

![AdaChrom pipeline: preprocessing, BVP extraction, and heart-rate post-processing](website/public/media/adachrom-pipeline.png)

*AdaChrom signal-processing pipeline.*

#### A. Pre-processing

In the pre-processing stage, AdaChrom establishes reliable spatial support for ROI-based signal
extraction. Specifically, facial landmarks are aligned to reduce motion-induced ROI shifts, while
valid facial skin regions are defined through ROI mask generation for subsequent BVP extraction.

##### i) Face Alignment

Face Alignment provides the geometric basis for all subsequent ROI operations. The aligned
landmarks also provide a validity check for each frame, and frames with missing, zero, or
non-finite landmark coordinates are excluded from the current estimation window. The details of
face alignment can be found in SeetaPsych Face Hub.

##### ii) ROI Mask Generation

After alignment, landmarks-defined polygon regions are used to construct facial ROI masks that
isolate skin-dominant facial areas. A skin-color constraint is further applied in YCrCb color
space. The final ROI mask is obtained by intersecting the geometric face mask with the detected
skin mask. For each valid ROI, the algorithm records both the mean BGR value and the number of
effective pixels, so empty or unreliable ROIs can be rejected before signal estimation. Four ROI
strategies are supported in this implementation.

**Legacy YCrCb Skin ROI (AdaChrom-v1):** The legacy skin ROI first constructs a full-face mask
from the facial landmarks and then applies a fixed YCrCb skin-color rule to identify skin pixels
within the face region.

**Fixed Forehead-seeded Skin ROI (AdaChrom-v2):** The fixed forehead strategy uses a predefined
landmark-based forehead region as the seed area for skin-color modeling. A two-dimensional
Gaussian model is fitted in the Cr/Cb color space using the seed pixels, and pixels within the
face region are retained when their color distribution is sufficiently close to the learned
forehead skin model.

**Adaptive Forehead-seeded Skin ROI (AdaChrom-v3):** The adaptive forehead strategy extends the
seed region around the forehead before estimating the Cr/Cb skin-color model. Compared with the
fixed forehead seed, this strategy is designed to include more reliable forehead skin pixels and
improve robustness when the fixed seed area is too small or partially affected by local landmark
variation.

**Connected-component-filtered Skin ROI (AdaChrom-v4):** In addition to the adaptive forehead
strategy, the connected-component strategy further filters the candidate skin regions according
to spatial connectivity. Isolated false-positive regions are removed, while larger connected
components that are spatially consistent with the face skin area are preserved for subsequent
BGR signal extraction.

#### B. BVP Extraction

In the BVP extraction stage, AdaChrom converts spatial color observations from facial ROIs into
temporal color traces and recovers the pulse-related BVP signal from these traces. This stage
aggregates valid ROI measurements over a sliding temporal window, providing the signal
representation used for subsequent heart-rate estimation.

##### i) ROI Color Signal Extraction

For every valid frame and ROI, the algorithm computes the spatial mean of the BGR pixel values
inside the ROI mask:

$$
c_t = [\overline{B_t}, \overline{G_t}, \overline{R_t}]
$$

This produces a temporal color trace for each ROI. Because remote photoplethysmography relies on
subtle skin-color variations caused by blood volume changes, spatial averaging is used to
suppress pixel-level noise and preserve the dominant temporal variation.

Before pulse extraction, the irregularly sampled color observations are regularized onto an
evenly spaced time grid using the frame timestamps. The signal is then smoothed to reduce
high-frequency noise and normalized by each channel's temporal mean to reduce illumination-scale
effects.

##### ii) Pulse Signal Extraction

The core BVP extraction model follows a CHROM-style chrominance projection. The normalized
RGB traces are transformed into two chrominance components:

$$
X = 3R - 2G
$$

$$
Y = 1.5R + G - 1.5B
$$

The pulse signal is then computed by balancing the two components according to their temporal
standard deviations:

$$
\alpha = \frac{std(X)}{std(Y)}
$$

$$
s(t) = X - \alpha Y
$$

This projection emphasizes color changes associated with blood volume pulse while suppressing
illumination variation and motion-related intensity changes. The projected BVP signal is then
mean-centered, scaled, and smoothed before spectral analysis.

#### C. Post-processing

The post-processing stage converts the extracted BVP signal into the final heart-rate estimate
through FFT-based spectral analysis and peak selection. A Hamming window is applied before the
real-valued FFT to reduce spectral leakage. The magnitude spectrum is searched within the
estimator's valid heart-rate range, approximately 50-120 bpm. The dominant spectral peak is
selected as the heart-rate frequency and converted to beats per minute.

$$
f_{peak} = \underset{f}{\arg\max}\, |FFT(s(t))|
$$

$$
HR = 60 f_{peak}
$$

## Installation

This project is included in the default SeetaPsych configuration. Download its modules
with:

```bash
seetapsych-manager download
```

For the complete framework workflow, see
[SeetaPsych](https://github.com/seetapsych/seetapsych-lib).

## Module Zoo

| Module | Description | Input modes |
|---|---|---|
| [AdaChrom](https://github.com/seetapsych/seetapsych-hertz/blob/main/seetapsych_hertz/modules/ada-chrom.yml) | Chrominance-based rPPG on adaptive skin ROIs, without a learned pulse estimator | Video stream · video file |
| [TinyHR](https://github.com/seetapsych/seetapsych-hertz/blob/main/seetapsych_hertz/modules/tiny-hr.yml) | Convolutional rPPG waveform estimation with Welch PSD-based heart-rate post-processing | Video stream · video file |

### AdaChrom

> Model-free rPPG heart rate estimation using adaptive chrominance analysis on skin ROI.

Module config: [ada-chrom.yml](https://github.com/seetapsych/seetapsych-hertz/blob/main/seetapsych_hertz/modules/ada-chrom.yml)

| Package | Provides | Requires |
|---|---|---|
| HeartRate-AdaChrom | `face/heart_rate` | `face/dense_landmarks` |

**Description**

Adaptive chrominance rPPG heart rate estimator from adaptive forehead ROI, no neural model required.

**Usage Notes**

- Supports both video streams and video files.
- For video stream mode, best results are achieved at 30 FPS or higher, which requires optimized processing logic and better hardware (with GPU).
- For stable analysis results, it is recommended to use video files with a stable frame rate of 30 FPS or higher.

**Parameters**

| Name | Type | Default | Description & Tuning |
|---|---|---|---|
| `window_samples` | integer | `300` | Sliding window frame count for HR estimation. Larger values reduce noise but increase latency; adjust based on real-time demand. |
| `roi_regions` | `selection[]` | `["skin_b_adaptive_forehead"]` | List of regions to use for HR estimation. Defaults to ["skin_b_adaptive_forehead"]. Multiple selectors are evaluated independently, with valid results merged into the fused `hr_bpm` and the per-region `roi_hr_bpm` map. |

**Models**

*(None)*

**Output Attributes**
- `face/heart_rate` — [spec](https://github.com/seetapsych/seetapsych-attributes#faceheart_rate).

The per-region results requested via `roi_regions` are returned inside `roi_hr_bpm`: each key corresponds to one selected ROI and the value is that region's heart rate in BPM for the current window.

## Resources

- [TinyHR documentation](seetapsych_hertz/tinyhr/README.md)
- [TinyHR 中文文档](seetapsych_hertz/tinyhr/README_CN.md)
- [HERTZ Project Website](https://seetapsych.github.io/seetapsych-hertz/)
- [Interactive project page source](https://github.com/seetapsych/seetapsych-hertz/tree/main/website)
- Hugging Face model distribution and interactive demos are planned.

## License

This project is released under the [BSD 3-Clause License](https://github.com/seetapsych/seetapsych-hertz/blob/main/LICENSE).

## Affiliations

<p align="center">
  <a href="https://scholar.google.com/citations?user=HRBTJYYAAAAJ" title="Southeast University"><img src="https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/affiliations/southeast-university.png" alt="Southeast University" height="104" /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://vipl.ict.ac.cn/en/index.html" title="Institute of Computing Technology, Chinese Academy of Sciences"><img src="https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/affiliations/ict-cas.png" alt="Institute of Computing Technology, Chinese Academy of Sciences" height="72" /></a>
</p>
