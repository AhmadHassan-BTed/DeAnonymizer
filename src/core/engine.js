/**
 * Pinpoint Framework: Dynamic Engine
 * Zero Coupling // High Cohesion
 */

import { ExecutionLogger } from './logger.js';

export const PinpointEngine = {
    modules: [],

    async bootstrap() {
        try {
            await ExecutionLogger.init();
            // Discover modules from manifest
            const response = await fetch('./src/config/modules.json');
            const { active_modules } = await response.json();

            // Dynamic Import (Zero Coupling)
            const loadPromises = active_modules.map(async (path) => {
                try {
                    // Import dynamically using relative path
                    const module = await import(`../../${path}`);
                    return module.default;
                } catch (e) {
                    console.error(`Failed to load module at ${path}:`, e);
                    return null;
                }
            });

            this.modules = (await Promise.all(loadPromises)).filter(m => m !== null);
            this.render();
        } catch (e) {
            console.error("Framework Bootstrap Failed:", e);
        }
    },

    render() {
        const container = document.getElementById('sections-container');
        if (!container) return;
        container.innerHTML = ''; // Clear existing

        const levels = [
            { lvl: 1, title: 'Level 1 // Standard Reconnaissance' },
            { lvl: 2, title: 'Level 2 // Advanced Profiling' },
            { lvl: 3, title: 'Level 3 // Critical Intelligence' },
            { lvl: 4, title: 'Level 4 // High-Fidelity HW Exploits' },
            { lvl: 5, title: 'Level 5 // Weaponized Vectors (Sandboxed Auditor)' },
            { lvl: 6, title: 'Level 6 // Social Engineering & Media (Sandboxed Auditor)' }
        ];

        levels.forEach(level => {
            const section = document.createElement('div');
            section.className = `threat-section lvl-${level.lvl}`;
            section.innerHTML = `
                <div class="threat-header">${level.title}</div>
                <div class="grid" id="grid-${level.lvl}"></div>
            `;
            container.appendChild(section);
        });

        this.modules.forEach(mod => {
            const grid = document.getElementById(`grid-${mod.level}`);
            if (!grid) return;

            const isStub = mod.info && (mod.info.includes('Disabled') || mod.info.includes('disabled'));
            const statusBadge = isStub ? '<span style="color:#ff003c; font-size:8px; margin-left:6px; letter-spacing:1px; border:1px solid #ff003c; padding:2px 4px; border-radius:2px;">[DISABLED]</span>' : '';
            const initialTerminalText = isStub
                ? ">> STATUS: DISABLED_BY_POLICY\n>> NOTICE: Offensive payload omitted per security policies."
                : "_AWAITING_COMMAND...";

            const card = document.createElement('div');
            card.className = 'cyber-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                        <div class="info-btn" id="info-${mod.id}">i</div>
                        <span style="font-size: 10px; font-weight: bold; letter-spacing: 2px;">${mod.title}</span>
                        ${statusBadge}
                    </div>
                    <button class="cyber-btn" id="exec-${mod.id}">EXEC</button>
                </div>
                <pre id="field-${mod.id}" class="terminal-output">${initialTerminalText}</pre>
            `;
            grid.appendChild(card);

            document.getElementById(`info-${mod.id}`).onclick = () => this.showRisk(mod);
            document.getElementById(`exec-${mod.id}`).onclick = () => this.runModule(mod);
        });
    },

    showRisk(mod) {
        const modal = document.getElementById('modal-box');
        modal.className = `modal-content m-lvl-${mod.level}`;
        document.getElementById('m-title').innerText = `RECON_INTEL: ${mod.id.toUpperCase()}`;
        let list = '<ul class="steps-list">' + mod.steps.map(s => `<li>${s}</li>`).join('') + '</ul>';
        document.getElementById('m-body').innerHTML = `
            <p><b class="m-accent" style="letter-spacing:2px; text-transform:uppercase;">Exposure:</b><br><span class="m-accent" style="opacity:0.8;">${mod.info}</span></p>
            <span class="m-accent" style="font-weight:bold; letter-spacing:2px; text-transform:uppercase;">Attack_Phases:</span>
            ${list}
        `;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    async runModule(mod) {
        const field = document.getElementById(`field-${mod.id}`);
        if (field) field.innerText = ">> INITIALIZING_DYNAMIC_MODULE...\n>> PROBING_VECTORS...";
        try {
            const data = await mod.run();
            await ExecutionLogger.log(mod.id, mod.level, data);
            if (data.status === 'NOT_IMPLEMENTED') {
                if (field) field.innerText = `>> EXECUTION_HALTED\n>> STATUS: ${data.status}\n>> REASON: ${data.message}`;
            } else {
                if (field) field.innerText = ">> DATA_ACQUIRED\n>> PAYLOAD:\n" + JSON.stringify(data, null, 2);
            }
            return data;
        } catch (error) {
            await ExecutionLogger.log(mod.id, mod.level, { error: error.message });
            if (field) field.innerText = ">> EXECUTION_TERMINATED\n>> " + error.message;
            return { error: error.message };
        }
    },

    async runAll() {
        const results = {};
        const promises = this.modules.map(async (mod) => {
            results[mod.id] = await this.runModule(mod);
        });
        await Promise.all(promises);
        return results;
    }
};
