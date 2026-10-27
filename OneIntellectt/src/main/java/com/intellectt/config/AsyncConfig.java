package com.intellectt.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Enables {@code @Async} so notification emails are sent on a background thread
 * and don't slow down the workflow HTTP requests.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "mailExecutor")
    public Executor mailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        // Room for a busy burst of approvals while SMTP (1-3 s per email) catches up.
        executor.setQueueCapacity(5000);
        executor.setThreadNamePrefix("mail-");
        // If the queue is ever full, drop that email with a log line instead of throwing:
        // a rejected email must never fail (and roll back) the approval that triggered it.
        executor.setRejectedExecutionHandler((task, pool) -> org.slf4j.LoggerFactory.getLogger(AsyncConfig.class)
                .error("Email queue full ({} queued); a notification email was dropped", pool.getQueue().size()));
        executor.initialize();
        return executor;
    }
}
