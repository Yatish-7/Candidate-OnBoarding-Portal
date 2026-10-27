
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests clean package \
    && test -f target/OneIntellectt-0.0.1-SNAPSHOT.war \
    && cp target/OneIntellectt-0.0.1-SNAPSHOT.war /app/application.war

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/application.war /app/application.war

EXPOSE 5000

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/application.war"]
