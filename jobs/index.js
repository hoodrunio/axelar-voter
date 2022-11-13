import checkPollsJob from "./check-polls-job.js";
import chainMaintainersJob from "./chain-maintainers-job.js";

export function setupJobs() {
    checkPollsJob();
    chainMaintainersJob();
}