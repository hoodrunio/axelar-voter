import fs from 'fs';

const SettingFileName = './settings.json';

export default {
    set(key, value) {
        const settings = this.load();
        settings[key] = value;
        this.save(settings);
    },
    get(key) {
        const settings = this.load();
        if (key in settings) {
            return settings[key];
        }
        return null;
    },
    load() {
        try {
            if (!fs.existsSync(SettingFileName)) {
                fs.writeFileSync(SettingFileName, JSON.stringify({}));
            }
            return JSON.parse(fs.readFileSync(SettingFileName, 'utf8'));
        } catch (error) {
            fs.writeFileSync(SettingFileName, JSON.stringify({}));
            return JSON.parse(fs.readFileSync(SettingFileName, 'utf8'));
        }
    },
    save(settings) {
        fs.writeFileSync(SettingFileName, JSON.stringify(settings));
    }
}