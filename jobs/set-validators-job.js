import {CronJob} from "cron";
import {setupValidators} from "../services/validators.js";


export default function setValidatorsJob() {
    let isRunning = false;
    const cronJob = new CronJob('0 0 * * * *', async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            console.log('setValidatorsJob started.');

            await setupValidators();

            console.log('setValidatorsJob finished.');
        } catch (error) {
            console.log('setValidatorsJob got error', error);
        } finally {
            isRunning = false;
        }
    });
    cronJob.start();
}