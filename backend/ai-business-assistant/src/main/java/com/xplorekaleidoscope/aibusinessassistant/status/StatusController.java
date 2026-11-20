package com.xplorekaleidoscope.aibusinessassistant.status;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class StatusController {
    @GetMapping(value = "/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public StatusResponse status() {
        return new StatusResponse("ok");
    }

    public record StatusResponse(String status) {}
}
