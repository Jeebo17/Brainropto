import React, { useEffect, useRef } from 'react';

const WORDS = [
    '67',
];

function randomBetween(a: number, b: number) {
  return Math.random() * (b - a) + a;
}

const BrainrotAttack: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const nodes: HTMLDivElement[] = [];
        let running = true;

        for (let i = 0; i < 67; i++) {
        const el = document.createElement('div');
        el.textContent = WORDS[Math.floor(Math.random() * WORDS.length)];
        el.style.position = 'fixed';
        el.style.left = randomBetween(0, 90) + 'vw';
        el.style.top = randomBetween(0, 90) + 'vh';
        el.style.fontSize = randomBetween(1.2, 3.5) + 'rem';
        el.style.color = '#ffffff';
        el.style.fontWeight = 'bold';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9999';
        el.style.transform = `rotate(${randomBetween(0, 360)}deg)`;
        el.style.transition = 'all 0.7s cubic-bezier(.68,-0.55,.27,1.55)';
        if (containerRef.current) containerRef.current.appendChild(el);
        nodes.push(el);
        }

        function animate() {
        if (!running) return;
        for (const el of nodes) {
            el.style.left = randomBetween(0, 100) + 'vw';
            el.style.top = randomBetween(0, 100) + 'vh';
            el.style.transform = `rotate(${randomBetween(0, 360)}deg) scale(${randomBetween(0.7, 2)})`;
            el.style.opacity = String(randomBetween(0.6, 1));
        }
        setTimeout(animate, randomBetween(400, 900));
        }
        animate();

        return () => {
        running = false;
        for (const el of nodes) {
            if (el.parentNode) el.parentNode.removeChild(el);
        }
        };
    }, []);

    return <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }} />;
};

export default BrainrotAttack;
