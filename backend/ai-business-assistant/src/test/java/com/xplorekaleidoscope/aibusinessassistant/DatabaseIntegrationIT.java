package com.xplorekaleidoscope.aibusinessassistant;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

/** Uses only the explicitly configured PostgreSQL database, never an embedded replacement. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DatabaseIntegrationIT {
    @Autowired
    private DataSource dataSource;
    @Autowired
    private Flyway flyway;
    @Autowired
    private TestRestTemplate http;

    @Test
    void migrationEnablesVectorOnPostgres17() throws Exception {
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("1");
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            try (ResultSet result = statement.executeQuery("SHOW server_version_num")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt(1)).isBetween(170000, 179999);
            }
            try (ResultSet result = statement.executeQuery(
                    "SELECT extversion FROM pg_extension WHERE extname = 'vector'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("0.8.5");
            }
        }
    }

    @Test
    void storesAndReadsActualVectorWithoutPersistentTestTables() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("CREATE TEMPORARY TABLE connectivity_vector_test (embedding vector(3)) ON COMMIT DROP");
                }
                try (PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO connectivity_vector_test (embedding) VALUES (?::vector)")) {
                    insert.setString(1, "[1,0,0]");
                    assertThat(insert.executeUpdate()).isEqualTo(1);
                }
                try (Statement statement = connection.createStatement();
                     ResultSet result = statement.executeQuery(
                             "SELECT embedding::text, embedding <-> '[0,1,0]'::vector FROM connectivity_vector_test")) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getString(1)).isEqualTo("[1,0,0]");
                    assertThat(result.getDouble(2)).isCloseTo(Math.sqrt(2), org.assertj.core.data.Offset.offset(1e-9));
                }
            } finally {
                connection.rollback();
            }
        }
    }

    @Test
    void servesHealthAndStatusOverRealHttp() {
        var health = http.getForEntity("/actuator/health", String.class);
        assertThat(health.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(health.getBody()).isEqualTo("{\"status\":\"UP\"}");
        var status = http.getForEntity("/api/v1/status", String.class);
        assertThat(status.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(status.getBody()).isEqualTo("{\"status\":\"ok\"}");
    }
}
