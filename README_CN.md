<div align="center">

# HERTZ

<img src="https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/tinyhr-logo.png" width="460" alt="HERTZ 标志">

### 面向人脸视频的开源心率估计算法集合

HERTZ 将多种互补的心率估计方法组织为可扩展的开源算法集合。TinyHR 从人脸视频学习脉搏波形，
AdaChrom 则通过无需训练的色度信号处理管线恢复脉搏信号。该集合采用模块化组织，以支持后续
rPPG 心率估计算法的纳入、独立描述与比较。

[English](README.md) | [简体中文](README_CN.md)

[HERTZ 项目主页](https://seetapsych.github.io/seetapsych-hertz/zh/)

[项目简介](#项目简介) · [算法集合](#hertz-心率估计算法集合) · [安装](#安装) · [模块库](#模块库) · [资源](#项目资源)

[![Python](https://img.shields.io/badge/Python-3.10%2B-2563D8?logo=python&logoColor=white)](https://github.com/seetapsych/seetapsych-hertz/blob/main/pyproject.toml)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-75E5C9)](https://github.com/seetapsych/seetapsych-hertz/blob/main/LICENSE)

</div>

## 项目简介

HERTZ 为
[SeetaPsych](https://github.com/seetapsych/seetapsych-lib) 生态提供心率估计模块。
项目包含两种开源的远程光电容积描记（rPPG）心率估计方案：**TinyHR** 是从人脸视频预测
脉搏波形的轻量级卷积模型；**AdaChrom** 是基于自适应皮肤区域筛选、色度投影与
频谱分析的无监督信号处理方法。

## HERTZ 心率估计算法集合

### TinyHR：轻量学习型 rPPG

TinyHR 是从人脸视频预测 rPPG 波形、再通过频谱后处理估计心率的轻量学习型方法。
训练数据、模型架构、参考推理时间、评估方案与调用示例详见
[TinyHR 英文文档](seetapsych_hertz/tinyhr/README.md) 和
[TinyHR 中文文档](seetapsych_hertz/tinyhr/README_CN.md)。

### AdaChrom：无监督色度 rPPG

AdaChrom 是一种基于人脸视频的无监督远程光电容积描记（rPPG）心率估计方法。它不依赖
带标签的训练数据，而是利用面部皮肤区域细微的时序颜色变化，估计与脉搏相关的血容量
脉搏（BVP）信号，为非接触式心率估计提供可解释的技术方案。给定人脸视频序列后，处理流程
包括三个阶段：预处理完成人脸对齐与感兴趣区域（ROI）掩膜生成；BVP 提取在滑动时间窗口内
计算有效面部区域的平均 BGR 颜色信号并恢复 BVP；后处理通过频域分析和峰值选择估计心率。

![AdaChrom 流程：预处理、BVP 提取和心率后处理](website/public/media/adachrom-pipeline.png)

*AdaChrom 信号处理流程。*

#### A. 预处理

预处理阶段为基于 ROI 的信号提取建立可靠的空间支撑。具体而言，首先对齐面部关键点，
以减小运动引起的 ROI 偏移；随后生成 ROI 掩膜，确定有效的面部皮肤区域，供后续 BVP
信号提取使用。

##### i) 人脸对齐

人脸对齐为后续所有 ROI 操作提供几何基础。对齐后的关键点也用于检查每一帧的有效性；
若某一帧的关键点坐标缺失、为零或包含非有限数值，则将该帧从当前估计窗口中排除。
人脸对齐的具体方法参见 SeetaPsych Face Hub。

##### ii) ROI 掩膜生成

完成对齐后，根据面部关键点定义多边形区域，并由此构建面部 ROI 掩膜，以分离皮肤占主导
的面部区域。随后在 YCrCb 颜色空间中施加肤色约束，取几何人脸掩膜与肤色检测掩膜的
交集作为最终 ROI 掩膜。对于每个有效 ROI，算法同时记录平均 BGR 值和有效像素数量，
从而在信号估计前排除空 ROI 或可靠性不足的 ROI。当前实现支持以下四种 ROI 策略。

**传统 YCrCb 皮肤 ROI（AdaChrom-v1）：** 首先依据面部关键点构建完整人脸掩膜，
随后采用固定的 YCrCb 肤色规则，在人脸区域内识别皮肤像素。

**固定前额种子皮肤 ROI（AdaChrom-v2）：** 采用预定义的、基于关键点的前额区域作为
肤色建模的种子区域。利用种子像素在 Cr/Cb 颜色空间中拟合二维高斯模型；当人脸区域内
像素的颜色分布与学习得到的前额皮肤模型足够接近时，保留该像素。

**自适应前额种子皮肤 ROI（AdaChrom-v3）：** 在估计 Cr/Cb 肤色模型之前，对前额周围
的种子区域进行扩展。相较于固定前额种子，该策略能够纳入更多可靠的前额皮肤像素；
当固定种子区域过小，或局部关键点变化对其造成影响时，可提高 ROI 提取的稳健性。

**连通分量筛选皮肤 ROI（AdaChrom-v4）：** 在自适应前额策略的基础上，进一步依据
空间连通性筛选候选皮肤区域。算法去除孤立的假阳性区域，并保留与面部皮肤区域在空间上
一致的较大连通分量，用于后续 BGR 信号提取。

#### B. BVP 提取

BVP 提取阶段将面部 ROI 中的空间颜色观测转换为时序颜色轨迹，并从中恢复与脉搏相关的
BVP 信号。该阶段在滑动时间窗口内汇聚有效 ROI 的测量结果，形成后续心率估计所需的
信号表示。

##### i) ROI 颜色信号提取

对于每个有效帧及其 ROI，算法计算 ROI 掩膜内 BGR 像素值的空间均值：

$$
c_t = [\overline{B_t}, \overline{G_t}, \overline{R_t}]
$$

由此可为每个 ROI 获得一条时序颜色轨迹。远程光电容积描记依赖血容量变化引起的细微
皮肤颜色变化，因此采用空间平均抑制像素级噪声，同时保留占主导地位的时序变化。

在提取脉搏信号之前，算法根据帧时间戳，将不规则采样的颜色观测重采样至等间隔时间网格。
随后对信号进行平滑以降低高频噪声，并以各通道的时序均值进行归一化，以减弱光照尺度
变化的影响。

##### ii) 脉搏信号提取

BVP 提取的核心模型采用 CHROM 色度投影。首先将归一化后的 RGB 轨迹变换为两个色度分量：

$$
X = 3R - 2G
$$

$$
Y = 1.5R + G - 1.5B
$$

随后依据两个分量的时序标准差对其进行平衡，并计算脉搏信号：

$$
\alpha = \frac{std(X)}{std(Y)}
$$

$$
s(t) = X - \alpha Y
$$

该投影突出与血容量脉搏相关的颜色变化，同时抑制光照变化及运动导致的强度变化。
在频谱分析之前，进一步对投影得到的 BVP 信号进行去均值、尺度调整和平滑处理。

#### C. 后处理

后处理阶段通过基于快速傅里叶变换（FFT）的频谱分析和峰值选择，将提取的 BVP 信号转换为
最终心率估计。执行实值 FFT 之前，先施加汉明窗（Hamming 窗）以减小频谱泄漏；随后在估计器的
有效心率范围内（约 50–120 BPM）搜索幅度谱，选择占主导地位的谱峰作为心率频率，并将其
换算为每分钟心搏次数。

$$
f_{peak} = \underset{f}{\arg\max}\, |FFT(s(t))|
$$

$$
HR = 60 f_{peak}
$$

## 安装

本项目已包含在 SeetaPsych 默认配置中，可通过以下命令下载模块：

```bash
seetapsych-manager download
```

完整框架使用方法请参见
[SeetaPsych](https://github.com/seetapsych/seetapsych-lib)。

## 模块库

| 模块 | 说明 | 输入方式 |
|---|---|---|
| [AdaChrom](https://github.com/seetapsych/seetapsych-hertz/blob/main/seetapsych_hertz/modules/ada-chrom.yml) | 基于自适应皮肤 ROI 的色度 rPPG 方法，脉搏估计不依赖学习模型 | 视频流 · 视频文件 |
| [TinyHR](https://github.com/seetapsych/seetapsych-hertz/blob/main/seetapsych_hertz/modules/tiny-hr.yml) | 卷积式 rPPG 波形估计，结合基于 Welch PSD 的心率后处理 | 视频流 · 视频文件 |

### AdaChrom

> 基于自适应皮肤 ROI 的色度分析实现无模型 rPPG 心率估计。

模块配置：[ada-chrom.yml](https://github.com/seetapsych/seetapsych-hertz/blob/main/seetapsych_hertz/modules/ada-chrom.yml)

| 包 | 提供 | 依赖 |
|---|---|---|
| HeartRate-AdaChrom | `face/heart_rate` | `face/dense_landmarks` |

**说明**

基于自适应额头 ROI 的色度 rPPG 心率估计器，无需神经网络模型。

**使用说明**

- 同时支持视频流与视频文件输入。
- 视频流模式下，30 FPS 或更高帧率可获得最佳效果，需优化处理逻辑与更好的硬件（GPU）。
- 为获得稳定的分析结果，推荐使用帧率稳定在 30 FPS 或以上的视频文件。

**参数**

| 名称 | 类型 | 默认值 | 说明与调优 |
|---|---|---|---|
| `window_samples` | integer | `300` | 心率估计的滑动窗口帧数。数值越大噪声越低但延迟越高；需根据实时性需求调整。 |
| `roi_regions` | `selection[]` | `["skin_b_adaptive_forehead"]` | 用于心率估计的区域列表。默认为 `["skin_b_adaptive_forehead"]`。多个选择器独立计算，有效结果融合至 `hr_bpm`，各区域独立结果保存在 `roi_hr_bpm` 映射中。 |

**模型**

*(无)*

**输出属性**

- `face/heart_rate` — [规格说明](https://github.com/seetapsych/seetapsych-attributes#faceheart_rate)。

通过 `roi_regions` 请求的各区域结果返回在 `roi_hr_bpm` 中：每个键对应一个选中的 ROI，值为该区域在当前窗口内的心率（BPM）。

## 项目资源

- [TinyHR 英文文档](seetapsych_hertz/tinyhr/README.md)
- [TinyHR 中文文档](seetapsych_hertz/tinyhr/README_CN.md)
- [HERTZ 项目主页](https://seetapsych.github.io/seetapsych-hertz/zh/)
- [交互式项目主页源码](https://github.com/seetapsych/seetapsych-hertz/tree/main/website)
- Hugging Face 模型发布与交互式演示正在规划中。

## 开源许可

本项目使用 [BSD 3-Clause License](https://github.com/seetapsych/seetapsych-hertz/blob/main/LICENSE) 发布。

## 项目机构

<p align="center">
  <a href="https://mysee1989.github.io/" title="东南大学"><img src="https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/affiliations/southeast-university.png" alt="东南大学" height="104" /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://vipl.ict.ac.cn/" title="中国科学院计算技术研究院"><img src="https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/affiliations/ict-cas.png" alt="中国科学院计算技术研究院" height="72" /></a>
</p>
