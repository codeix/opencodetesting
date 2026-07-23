---
name: setup-java-skeleton
description: >
  Creates the Java/Maven project skeleton (pom.xml, config/test.properties,
  TestConfig, BaseTest, src/test/java folders) that generated Selenium tests need to
  compile and run, for whichever Java test framework the project uses (JUnit 5 by
  default, TestNG also supported — never assume JUnit specifically). Use this ONCE
  per project, BEFORE the first generate-pageobject / generate-test run, or whenever
  validate-test fails because pom.xml or TestConfig is missing. Do not regenerate
  files that already exist — this skill is setup, not repair.
---

# setup-java-skeleton

## Input
Nothing from the page or from other skills. Two values, asked from the developer if
not already known: the base URL of the application under test and the test username
(never the password — see AGENTS.md "Secrets"). Plus, if `pom.xml` doesn't exist yet,
which Java test framework to use.

## Context budget
No page snapshot, no screenshot, no existing-file excerpts. This skill is pure
copy-from-template: the complete file contents are given below, one variant per
supported test framework — copy the matching variant verbatim, only substituting the
base URL and username. Do not invent, extend, or "improve" the templates, and do not
mix pieces of one framework's variant with another's. Create one file per step,
never all files in one giant response.

## Procedure
1. Check what already exists (`pom.xml`, `config/test.properties`,
   `src/test/java/`). Skip every file that is already there and say so.
2. **Decide the test framework.** If `pom.xml` already exists, detect it from its
   dependencies (`org.junit.jupiter` → JUnit 5, `org.testng` → TestNG) and use that
   framework's template variant for any file still missing — never introduce a
   second framework into a project that already picked one. If `pom.xml` doesn't
   exist yet, ask the developer which to use; default to JUnit 5 if they have no
   preference.
3. Create the folders `src/test/java/pages/`, `src/test/java/tests/`,
   `src/test/java/support/`, and `config/`.
4. Write `pom.xml` from the template below for the chosen framework, verbatim.
5. Write `config/test.properties` from the template, substituting `base.url` and
   `test.username` with the developer's values. (Same for every framework.)
6. Write `src/test/java/support/TestConfig.java` from the template, verbatim. (Same
   for every framework — it has no test-framework dependency at all.)
7. Write `src/test/java/support/BaseTest.java` from the template below for the
   chosen framework, verbatim.
8. Validate with `mvn -q test-compile`. If it fails, report the Maven error verbatim
   and stop — do not loop.
9. Commit the new files with message `Add Java/Selenium project skeleton`.

## Output
The list of files created (or skipped as already present) plus the result line of
`mvn -q test-compile`. No file contents in the final answer — they are on disk.

---

## Template: pom.xml (JUnit 5 — default)

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
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
      </plugin>
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

## Template: pom.xml (TestNG)

Identical to the JUnit 5 variant above except the test-framework dependency and
version property — everything else (Selenium, WebDriverManager, compiler/surefire
plugins, the `excludedGroups` config) is the same:

```xml
    <selenium.version>4.27.0</selenium.version>
    <testng.version>7.10.2</testng.version>
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
      <groupId>org.testng</groupId>
      <artifactId>testng</artifactId>
      <version>${testng.version}</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.github.bonigarcia</groupId>
      <artifactId>webdrivermanager</artifactId>
      <version>${webdrivermanager.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
```

## Template: config/test.properties

```properties
# Commit-friendly configuration — NO secrets in this file (see AGENTS.md "Secrets").
base.url=<BASE_URL>
test.username=<TEST_USERNAME>
# The password is NOT here. TestConfig resolves secret("TEST_PASSWORD") from the
# TEST_PASSWORD environment variable or ai/.install/secrets.env (gitignored).
```

## Template: src/test/java/support/TestConfig.java

```java
package support;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/** Reads config/test.properties; resolves secrets from the environment or ai/.install/secrets.env. */
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
        Path secretsFile = Path.of("ai", ".install", "secrets.env");
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

## Template: src/test/java/support/BaseTest.java (JUnit 5 — default)

```java
package support;

import io.github.bonigarcia.wdm.WebDriverManager;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

/** Base class for all generated tests: real Chrome, no hardcoded waits. */
public abstract class BaseTest {

    protected WebDriver driver;

    @BeforeEach
    void startBrowser() {
        ChromeOptions options = new ChromeOptions();
        // CI/sandboxed runners without a system Chrome install can point this at any
        // Chrome/Chromium binary (e.g. a CI cache) without touching test code. If that
        // binary's version doesn't match WebDriverManager's default (latest) driver,
        // CHROME_DRIVER_VERSION pins the matching driver explicitly.
        String chromeBinary = System.getenv("CHROME_BIN");
        String chromeDriverVersion = System.getenv("CHROME_DRIVER_VERSION");
        WebDriverManager wdm = WebDriverManager.chromedriver();
        if (chromeDriverVersion != null && !chromeDriverVersion.isBlank()) {
            wdm.driverVersion(chromeDriverVersion);
        }
        wdm.setup();
        if (chromeBinary != null && !chromeBinary.isBlank()) {
            options.setBinary(chromeBinary);
        }
        driver = new ChromeDriver(options);
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

## Template: src/test/java/support/BaseTest.java (TestNG)

Identical to the JUnit 5 variant above except the lifecycle annotations
(`@BeforeMethod`/`@AfterMethod` instead of `@BeforeEach`/`@AfterEach`) — the method
bodies are exactly the same:

```java
package support;

import io.github.bonigarcia.wdm.WebDriverManager;
import java.time.Duration;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

/** Base class for all generated tests: real Chrome, no hardcoded waits. */
public abstract class BaseTest {

    protected WebDriver driver;

    @BeforeMethod
    void startBrowser() {
        ChromeOptions options = new ChromeOptions();
        String chromeBinary = System.getenv("CHROME_BIN");
        String chromeDriverVersion = System.getenv("CHROME_DRIVER_VERSION");
        WebDriverManager wdm = WebDriverManager.chromedriver();
        if (chromeDriverVersion != null && !chromeDriverVersion.isBlank()) {
            wdm.driverVersion(chromeDriverVersion);
        }
        wdm.setup();
        if (chromeBinary != null && !chromeBinary.isBlank()) {
            options.setBinary(chromeBinary);
        }
        driver = new ChromeDriver(options);
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(5));
        driver.get(TestConfig.get("base.url"));
    }

    @AfterMethod
    void stopBrowser() {
        if (driver != null) {
            driver.quit();
        }
    }
}
```
