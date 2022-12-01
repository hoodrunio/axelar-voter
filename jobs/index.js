import checkPollsJob from "./check-polls-job.js";
import chainMaintainersJob from "./chain-maintainers-job.js";
import setValidatorsJob from "./set-validators-job.js";

// setup all jobs
export function setupJobs() {
    checkPollsJob();
    chainMaintainersJob();
    setValidatorsJob();
}