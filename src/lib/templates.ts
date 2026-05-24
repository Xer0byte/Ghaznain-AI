export const STARTER_TEMPLATES = [
  {
    id: 'dashboard',
    title: 'Tailwind Dashboard Card',
    description: 'Modern analytical chart with micro-layouts and glowing decor.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
    </style>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-[#00ff9d]/30 transition-all duration-500">
        <!-- Decoration Glow -->
        <div class="absolute -top-24 -right-24 w-48 h-48 bg-[#00ff9d]/10 rounded-full blur-3xl group-hover:bg-[#00ff9d]/20 transition-all duration-500"></div>
        
        <div class="flex justify-between items-start mb-6">
            <div>
                <span class="text-xs font-bold tracking-widest text-[#00ff9d] uppercase">SaaS Analytical Node</span>
                <h3 class="text-2xl font-black mt-1">Resource Overhead</h3>
            </div>
            <div class="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/50">
                <i class="fa-solid fa-chart-line text-[#00ff9d] text-lg animate-pulse"></i>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                <span class="text-xs text-slate-500 font-medium">Core Compute</span>
                <div class="text-lg font-bold mt-1 text-cyan-400">14.8 TFLOPS</div>
                <div class="text-[10px] text-emerald-500 mt-1"><i class="fa-solid fa-arrow-trend-up"></i> +12.4%</div>
            </div>
            <div class="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                <span class="text-xs text-slate-500 font-medium">Memory Cache</span>
                <div class="text-lg font-bold mt-1 text-purple-400">1.2 GB/s</div>
                <div class="text-[10px] text-red-500 mt-1"><i class="fa-solid fa-arrow-trend-down"></i> -1.8%</div>
            </div>
        </div>

        <div class="space-y-4">
            <div>
                <div class="flex justify-between text-xs mb-1.5 font-semibold">
                    <span class="text-slate-400">Node Load Distribution</span>
                    <span class="text-[#00ff9d]">76% Efficiency</span>
                </div>
                <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-cyan-500 via-[#00ff9d] to-emerald-400 rounded-full transition-all duration-1000" style="width: 76%"></div>
                </div>
            </div>
        </div>

        <div class="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active: cluster-delta-4</span>
            <button class="text-slate-200 hover:text-[#00ff9d] transition-colors font-bold uppercase tracking-wider text-[9px]" onclick="alert('Deploying analytics dashboard config to active swarm node.')">Deploy Node &rarr;</button>
        </div>
    </div>
</body>
</html>`
  },
  {
    id: 'canvas',
    title: 'Dynamic Physics Canvas',
    description: 'Dynamic interactive live physics particle mesh simulation canvas.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Interactive Physics Particle Mesh</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body, html { margin:0; padding:0; height:100%; overflow:hidden; }
    </style>
</head>
<body class="bg-neutral-950">
    <div class="absolute inset-0 z-10 flex flex-col justify-between p-6 pointer-events-none">
        <div>
            <span class="text-xs font-mono tracking-widest text-cyan-400 uppercase font-black">Inter-Mesh Sandbox</span>
            <h1 class="text-white text-3xl font-black mt-1">Fluid Physics Field</h1>
        </div>
        <p class="text-slate-500 text-xs font-mono">Move mouse around the canvas to activate physics ripple forces.</p>
    </div>
    <canvas id="canvas" class="block w-full h-full absolute inset-0 z-0"></canvas>

    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        
        const particles = [];
        const maxParticles = 120;
        const mouse = { x: null, y: null, radius: 150 };

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            mouse.x = null;
            mouse.y = null;
        });

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 1.5;
                this.vy = (Math.random() - 0.5) * 1.5;
                this.size = Math.random() * 3 + 1.5;
                this.color = 'rgba(0, 255, 157, ' + (Math.random() * 0.5 + 0.3) + ')';
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Wall collisions
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Mouse influence
                if (mouse.x !== null && mouse.y !== null) {
                    const dx = this.x - mouse.x;
                    const dy = this.y - mouse.y;
                    const distance = Math.hypot(dx, dy);
                    if (distance < mouse.radius) {
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x += (dx / distance) * force * 4;
                        this.y += (dy / distance) * force * 4;
                    }
                }
            }
        }

        // Initialize
        for (let i = 0; i < maxParticles; i++) {
            particles.push(new Particle());
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            // Render grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1;
            const gridSpacing = 40;
            for (let x = 0; x < width; x += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Update & Draw particles
            particles.forEach(p => {
                p.update();
                p.draw();
            });

            // Connect neighboring particles with glow
            ctx.lineWidth = 0.5;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                    if (dist < 110) {
                        const alpha = (1 - (dist / 110)) * 0.15;
                        ctx.strokeStyle = \`rgba(6, 182, 212, \${alpha})\`;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animate);
        }

        animate();
    </script>
</body>
</html>`
  },
  {
    id: 'signup',
    title: 'SaaS Signup Form',
    description: 'Clean high-converting signup layout with custom neon nebula glows.',
    language: 'html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
    </style>
</head>
<body class="bg-[#0b0c10] text-[#c5c6c7] min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Nebula background effects -->
    <div class="absolute -top-[30%] -left-[20%] w-[80%] h-[80%] bg-[#66fcf1]/8 rounded-full blur-[120px]"></div>
    <div class="absolute -bottom-[30%] -right-[20%] w-[80%] h-[80%] bg-[#45f3ff]/5 rounded-full blur-[140px]"></div>

    <div class="w-full max-w-md bg-[#1f2833]/60 border border-[#2f3d4e] rounded-3xl p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10">
        <div class="text-center mb-8">
            <div class="w-14 h-14 bg-gradient-to-tr from-[#66fcf1] to-teal-500 rounded-2xl mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(102,252,241,0.4)] mb-4">
                <i class="fa-solid fa-cube text-[#0b0c10] text-3xl"></i>
            </div>
            <h2 class="text-white text-3xl font-extrabold tracking-tight">Access the Engine</h2>
            <p class="text-gray-400 text-sm mt-1.5 font-medium">Create your secure developer workspace profile</p>
        </div>

        <form id="signupForm" class="space-y-5" onsubmit="event.preventDefault(); alert('Boilerplate validation successful! Workspace ready.');">
            <div>
                <label class="block text-xs uppercase tracking-widest text-[#66fcf1] font-bold mb-2">Username</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><i class="fa-regular fa-user"></i></span>
                    <input type="text" placeholder="neo_architect" required class="w-full pl-11 pr-4 py-3.5 bg-[#0b0c10]/50 border border-[#2f3d4e] rounded-2xl outline-none text-white text-sm focus:border-[#45f3ff] focus:ring-4 focus:ring-[#45f3ff]/10 hover:border-gray-600 transition-all font-medium" />
                </div>
            </div>

            <div>
                <label class="block text-xs uppercase tracking-widest text-[#66fcf1] font-bold mb-2">Workspace Email</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><i class="fa-regular fa-envelope"></i></span>
                    <input type="email" placeholder="neo@xer0box.network" required class="w-full pl-11 pr-4 py-3.5 bg-[#0b0c10]/50 border border-[#2f3d4e] rounded-2xl outline-none text-white text-sm focus:border-[#45f3ff] focus:ring-4 focus:ring-[#45f3ff]/10 hover:border-gray-600 transition-all font-medium" />
                </div>
            </div>

            <div>
                <label class="block text-xs uppercase tracking-widest text-[#66fcf1] font-bold mb-2">Access Keypad Code</label>
                <div class="relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><i class="fa-solid fa-lock"></i></span>
                    <input type="password" placeholder="••••••••" required class="w-full pl-11 pr-4 py-3.5 bg-[#0b0c10]/50 border border-[#2f3d4e] rounded-2xl outline-none text-white text-sm focus:border-[#45f3ff] focus:ring-4 focus:ring-[#45f3ff]/10 hover:border-gray-600 transition-all font-medium" />
                </div>
            </div>

            <div class="flex items-center justify-between text-xs font-semibold">
                <label class="flex items-center gap-2 cursor-pointer select-none text-gray-400 hover:text-white transition-colors">
                    <input type="checkbox" required class="accent-[#45f3ff] h-4 w-4 rounded-md border-gray-700 bg-black" />
                    Accept Protocol Terms
                </label>
            </div>

            <button type="submit" class="w-full bg-gradient-to-r from-[#66fcf1] to-emerald-400 hover:from-teal-400 hover:to-emerald-500 text-black font-extrabold uppercase tracking-widest text-xs py-4 rounded-2xl shadow-[0_10px_20px_rgba(102,252,241,0.2)] hover:shadow-[0_15px_25px_rgba(102,252,241,0.4)] transition-all duration-300 transform active:scale-[0.98]">
                Deploy Profile &rarr;
            </button>
        </form>

        <p class="text-xs text-center text-gray-400 mt-6 font-medium">
            Deploying with server clusters in Frankfurt • Dublin • Tokyo
        </p>
    </div>
</body>
</html>`
  }
];
