# Release 签名配置方案（阶段6）

**目的**：产出 release APK 所需的签名配置，keystore 文件与密码不入开源仓库。

## 一、keystore 生成参数（lead 代跑 keytool）

```bash
keytool -genkeypair -v \
  -keystore dsh-release.keystore \
  -alias dsh-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <由 lead 生成并保管> \
  -keypass <由 lead 生成并保管> \
  -dname "CN=DSH Task Orchestrator, OU=Dev, O=DSH, L=Beijing, ST=Beijing, C=CN"
```

## 二、gradle 签名配置（密码不入库）

密码通过**环境变量**注入（不写入 app/android/gradle.properties 或源码，避免泄露）：

1. 在 app/android/app/build.gradle 的 android 块追加 release 签名配置，从环境变量读取：
   ```groovy
   android {
       signingConfigs {
           release {
               if (System.getenv("DSH_KEYSTORE_PATH") != null) {
                   storeFile file(System.getenv("DSH_KEYSTORE_PATH"))
                   storePassword System.getenv("DSH_KEYSTORE_PASSWORD")
                   keyAlias System.getenv("DSH_KEY_ALIAS") ?: "dsh-release"
                   keyPassword System.getenv("DSH_KEY_PASSWORD")
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
           }
       }
   }
   ```

2. lead 代跑时设环境变量：
   ```
   DSH_KEYSTORE_PATH=<keystore 绝对路径>
   DSH_KEYSTORE_PASSWORD=<storepass>
   DSH_KEY_ALIAS=dsh-release
   DSH_KEY_PASSWORD=<keypass>
   ```

3. keystore 文件放工作区外（如 %USERPROFILE%\.dsh\ 或 lead 指定目录），不入 app/ 仓库；.gitignore 已排除 *.keystore。

## 三、安全合规

- 密码仅存环境变量/lead 本地，绝不写入源码、gradle.properties、README、GitHub。
- keystore 文件不入库（.gitignore *.keystore 已排除）。
- 与刑部开源合规"0 敏感信息泄漏"一致。

## 四、产出物

- lead 代跑后产出：app/android/app/build/outputs/apk/release/app-release.apk（release 签名，可侧载）。
- 侧载安装指引由礼部补充 release 版说明。
