# TinyHR

面向人脸视频心率估计的轻量学习型远程光电容积描记（rPPG）方法。

[HERTZ 算法集合](../../README_CN.md) · [English](README.md)

## 方法概述

TinyHR 从 160 帧人脸视频中预测脉搏波形，再通过确定性的滤波与频谱分析估计心率。导出的 ONNX 模型包含 **82,177 个参数元素**，文件大小约为 **381 KiB**。

## 演示

[![TinyHR 演示：人脸视频、预测脉搏波形和心率估计](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/tinyhr-demo.gif)](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/demo-full.mp4)

演示画面同时呈现检测到的人脸、预测的 rPPG 波形和心率估计，用于说明处理流程；模型精度见下文评估。

## 训练数据

TinyHR 使用四个 rPPG 数据集的子集训练。下表依据技术报告列出实际使用的训练数据，不代表原始数据集的完整规模。

| 数据集 | 训练受试者 | 训练视频 | 用途 |
|---|---:|---:|---|
| VIPL-HR V1 | 85 | 1,883 | 训练 |
| VIPL-HR V2 | 500 | 2,498 | 训练 |
| V4V | 103 | 726 | 训练 |
| MCD-rPPG | 600 | 1,200 | 训练；仅使用正脸视频 |
| **合计** | **1,288** | **6,307** | **四来源训练数据** |

VIPL-HR V1 测试集包含 **22 名受试者和 485 段视频**，未参与训练。

| 训练配置 | 设置 |
|---|---|
| 批大小 | 4 |
| 初始学习率 | 0.005 |
| 学习率调度器 | OneCycleLR |
| 输入视频片段 | 160 帧 RGB 人脸裁剪图像，每帧缩放至 128 × 128 像素 |

来源：[TinyHR 技术报告](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-technical-report.pdf)，第 1 页（模型输入）与第 6–7 页（训练数据和配置）。

## 模型规模与参考推理时间

| 测试项 | 结果 | 说明 |
|---|---:|---|
| 导出 ONNX 参数量 | **82,177** | 导出及卷积与归一化融合后的初始化张量元素数，不等同于导出前的可学习参数量。 |
| ONNX 文件大小 | **约 381 KiB** | 390,150 字节；SHA-256 与 tiny-hr.yml 声明的校验值一致。 |
| CPU 推理时间 | **平均 80 ms** | Intel Core i9-13900KF（3.00 GHz）上进行 100 次推理。 |
| GPU 推理时间 | **平均 6 ms** | 服务器 NVIDIA H20 GPU 上进行 100 次推理。 |
| 输入观测时长 | **30 FPS 时约 5.3 秒** | 收集 160 帧有效人脸图像所需时间；首个结果还受更新调度与计算耗时影响。 |
| 滚动更新间隔 | **默认 1.0 秒** | 按时间戳请求更新；30 FPS 时每个间隔约含 30 帧。 |

**测量范围。** 以上参考值分别测量两台设备上的 100 次模型推理，不包括视频采集、人脸检测、输入窗口收集和更新调度。未记录具体运行时配置；结果会随硬件与运行环境变化，且不等同于模型精度评估。

流式实现累积最长约 20 秒的预测波形用于心率估计，因此 1.0 秒更新间隔不等同于对生理变化的 1.0 秒响应。

## 模型架构与推理

[![TinyHR 架构和推理流程](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/tinyhr-flowchart.png)](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-flowchart.pdf)

| 阶段 | 模块 | 功能 |
|---:|---|---|
| 01 | 帧差融合 Stem | 将四组相邻帧 RGB 差分拼接为 12 通道，仅通过差分分支提取特征。 |
| 02 | 空间 Patch Embedding | 逐帧采用核大小与步幅均为 4 的二维卷积，以非重叠分块将 32 × 32 特征映射为 32 通道的 8 × 8 网格。 |
| 03 | 多尺度时序特征块 | 并行时间移位分支、逐点卷积、时序前馈网络和残差连接共同融合时间特征。 |
| 04 | 波形预测头 | 空间池化和两层逐点卷积为每帧生成一个 rPPG 采样值。 |
| 05 | 信号处理 | 去趋势、带通滤波和 Welch PSD 主峰共同得到心率估计。 |

推理阶段采用截止频率为 0.75 和 2.5 Hz 的 Butterworth 带通滤波器（对应 45–150 BPM），并在该频带内取 Welch PSD 最大峰值对应的频率计算心率：

~~~text
心率（BPM）= 60 × 主频（Hz）
~~~

## 训练目标

技术报告定义了三项训练目标：负 Pearson 相关系数约束时域波形一致性；交叉熵对 45–149 BPM 范围内的离散心率类别进行分类；KL 散度约束参考与预测频谱主峰的分布。三项权重依次为 0.2、1.0 和 1.0：

~~~text
L = 0.2 L_time + L_CE + L_KL
~~~

## 实验结果

| 数据集 | 测试集 | 实验方案 | MAE |
|---|---|---|---:|
| VIPL-HR V1 | 22 名受试者 · 485 段视频 | 留出测试集，未参与训练 | **3.88 BPM** |

技术报告在该留出测试集上报告的心率平均绝对误差（MAE）为 3.88 BPM。该结果仅反映这一评估方案下的性能，不能据此推断跨数据集泛化能力或临床测量精度。

## 模块配置与使用

模块配置：[tiny-hr.yml](../modules/tiny-hr.yml)

| 名称 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| fps | number | 30 | 用于波形缓冲与频谱分析的采样率，应与有效输入帧率一致。 |
| interval | number | 1 | 按时间戳触发的更新请求间隔，单位为秒；区别于观测时长与计算耗时。 |

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

完整的端到端可视化示例请参见 [examples/camera_heart_rate.py](https://github.com/seetapsych/seetapsych-hertz/blob/main/examples/camera_heart_rate.py)。

## 资源

- [完整演示视频](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/media/demo-full.mp4)
- [TinyHR 技术报告](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-technical-report.pdf)
- [模型架构图](https://raw.githubusercontent.com/seetapsych/seetapsych-hertz/main/website/public/downloads/tinyhr-flowchart.pdf)

