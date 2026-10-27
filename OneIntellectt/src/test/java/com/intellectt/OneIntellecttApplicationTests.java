package com.intellectt;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// "test" profile = the separate intellectt_test database, never the real one
@SpringBootTest
@ActiveProfiles("test")
class OneIntellecttApplicationTests {

	@Test
	void contextLoads() {
	}

}
