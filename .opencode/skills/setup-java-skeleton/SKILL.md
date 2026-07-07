---
name: setup-java-skeleton
description: >
  Creates the Java/Maven project skeleton (pom.xml, config/test.properties,
  TestConfig, BaseTest, src/test/java folders) that generated Selenium tests need to
  compile and run. Use this ONCE per project, BEFORE the first generate-pageobject /
  generate-test run, or whenever validate-test fails because pom.xml or TestConfig is
  missing. Do not regenerate files that already exist — this skill is setup, not repair.
---

# setup-java-skeleton

## Input
Nothing from the page or from other skills. Only two values, asked from the developer
if not already known: the base URL of the application under test and the test
username (never the password — see AGENTS.md "Secrets").

## Context budget
No page snapshot, no screenshot, no existing-file excerpts. This skill is pure
copy-from-template: the complete file contents are given below — copy them verbatim,
only substituting the base URL and username. Do not invent, extend, or "improve" the
templates. Create one file per step, never all files in one giant response.

## Procedure
1. Check what already exists (`pom.xml`, `config/test.properties`,
   `src/test/java/`). Skip every file that is already there and say so.
2. Create the folders `src/test/java/pages/`, `src/test/java/tests/`,
   `src/test/java/support/`, and `config/`.
3. Write `pom.xml` from the template below, verbatim.
4. Write `config/test.properties` from the template, substituting `base.url` and
   `test.username` with the developer's values.
5. Write `src/test/java/support/TestConfig.java` from the template, verbatim.
6. Write `src/test/java/support/BaseTest.java` from the template, verbatim.
7. Validate with `mvn -q test-compile`. If it fails, report the Maven error verbatim
   and stop — do not loop.
8. Commit the new files with message `Add Java/Selenium project skeleton`.

## Output
The list of files created (or skipped as already present) plus the result line of
`mvn -q test-compile`. No file contents in the final answer — they are on disk.

---

## Template: pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>ch.example</groupId>
  <artifactId>selenium-tests</artifactId>
  <version>1.0-SNAPSHOT</version>
  <packaging>jar</packaging>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <selenium.version>4.27.0</selenium.version>
    <junit.version>5.11.4</junit.version>
    <webdrivermanager.version>5.9.2</webdrivermanager.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.seleniumhq.selenium</groupId>
      <artifactId>selenium-java</artifactId>
      <version>${selenium.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>${junit.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.github.bonigarcia</groupId>
      <artifactId>webdrivermanager</artifactId>
      <version>${webdrivermanager.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
        <configuration>
          <!-- typography checks are opt-in, see check-typography skill -->
          <excludedGroups>typography-check</excludedGroups>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

## Template: config/test.properties

```properties
# Commit-friendly configuration — NO secrets in this file (see AGENTS.md "Secrets").
base.url=<BASE_URL>
test.username=<TEST_USERNAME>
# The password is NOT here. TestConfig resolves secret("TEST_PASSWORD") from the
# TEST_PASSWORD environment variable or .tools/secrets.env (gitignored).
```

## Template: src/test/java/support/TestConfig.java

```java
package support;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/** Reads config/test.properties; resolves secrets from the environment or .tools/secrets.env. */
public final class TestConfig {

    private static final Properties PROPS = load();

    private TestConfig() {}

    private static Properties load() {
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(Path.of("config", "test.properties"))) {
            p.load(in);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read config/test.properties", e);
        }
        return p;
    }

    public static String get(String key) {
        String value = PROPS.getProperty(key);
        if (value == null) {
            throw new IllegalStateException("Missing key in config/test.properties: " + key);
        }
        return value;
    }

    /** Secret values never live in test.properties or in generated code. */
    public static String secret(String name) {
        String fromEnv = System.getenv(name);
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        Path secretsFile = Path.of(".tools", "secrets.env");
        try {
            for (String line : Files.readAllLines(secretsFile)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                int eq = trimmed.indexOf('=');
                if (eq > 0 && trimmed.substring(0, eq).equals(name)) {
                    return trimmed.substring(eq + 1);
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("Secret " + name + " not in environment and "
                    + secretsFile + " is unreadable", e);
        }
        throw new IllegalStateException("Secret not found: " + name);
    }
}
```

## Template: src/test/java/support/BaseTest.java

```java
package support;

import io.github.bonigarcia.wdm.WebDriverManager;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

/** Base class for all generated tests: real Chrome, no hardcoded waits. */
public abstract class BaseTest {

    protected WebDriver driver;

    @BeforeEach
    void startBrowser() {
        WebDriverManager.chromedriver().setup();
        driver = new ChromeDriver();
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(5));
        driver.get(TestConfig.get("base.url"));
    }

    @AfterEach
    void stopBrowser() {
        if (driver != null) {
            driver.quit();
        }
    }
}
```
