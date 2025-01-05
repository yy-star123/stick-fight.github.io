let gameState = 'menu'; // menu, playing, gameover

// 获取按钮元素
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const menuOverlay = document.getElementById('menuOverlay');

// 添加按钮事件监听器
startButton.addEventListener('click', () => {
    gameState = 'playing';
    menuOverlay.style.display = 'none';
    // 重置游戏状态
    player.health = 100;
    player2.health = 100;
    player.x = 200;
    player.y = 200;
    player2.x = 600;
    player2.y = 200;
    // 开始游戏循环
    gameLoop();
});

restartButton.addEventListener('click', () => {
    location.reload(); // 重新加载页面来重启游戏
});

class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(ctx) {
        ctx.fillStyle = '#666';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class StickMan {
    constructor(x, y, color, isPlayer) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isPlayer = isPlayer;
        this.width = 20;
        this.height = 40;
        this.speed = 6;
        this.isAttacking = false;
        this.health = 100;
        
        // 简化下蹲相关属性
        this.isCrouching = false;
        this.normalHeight = 40;
        this.crouchHeight = 25;
        this.currentPlatform = null;  // 当前所在平台
        
        // 添加攻击相关属性
        this.attackType = 'normal';    // 当前攻击类型
        this.attackCooldown = 0;       // 攻击冷却时间
        this.skills = [
            { 
                name: 'fireball',
                damage: 35,
                cooldown: 100,
                range: 600,
                projectileSpeed: 15,
                projectileSize: 25,
                description: '火球术',
                hitWidth: 50
            },
            { 
                name: 'tornado',
                damage: 30,
                cooldown: 80,
                range: 400,
                slashWidth: 300,
                description: '龙卷风',
                hitWidth: 150
            }
        ];
        this.currentSkill = this.skills[Math.floor(Math.random() * this.skills.length)];
        
        // 添加技能动画相关属性
        this.skillAnimationFrame = 0;
        this.projectiles = [];
        
        // 修改跳跃相关属性
        this.velocityY = 0;       // Y轴速度
        this.gravity = 0.6;       // 重力
        this.jumpCount = 0;       // 跳跃次数
        this.maxJumpCount = 2;    // 最大跳跃次数（允许二段跳）
        this.jumpStrength = -15;  // 第一段跳跃力度
        this.doubleJumpStrength = -12; // 二段跳力度
        this.onGround = true;     // 是否在地面上
        
        // 添加特效相关属性
        this.particles = [];
        this.trails = [];
        this.dashSpeed = 15;
        this.dashCooldown = 0;
        
        // 添加攻击动画相关属性
        this.punchPhase = 0;      // 拳击动画阶段
        this.kickPhase = 0;       // 踢腿动画阶段
        this.attackRange = {      // 攻击范围
            normal: 150,          // 拳击范围从100增加到150
            kick: 180            // 踢腿范围从130增加到180
        };
        this.armLength = 15;      // 默认手臂长度
        this.legLength = 20;      // 默认腿长
        this.punchExtension = 60; // 出拳延伸距离从40增加到60
        this.kickExtension = 70;  // 踢腿延伸距离从50增加到70
        
        // 添加平台穿透控制
        this.canDropThrough = false;  // 是否可以穿透平台
        
        // 修改下蹲相关属性
        this.crouchTimer = null;
        this.crouchDuration = 0;    // 下蹲持续时间
        this.dropThrough = false;    // 是否允许穿透
        
        // 修改格挡相关属性
        this.isBlocking = false;
        this.blockCooldown = 0;
        this.blockCooldownTime = 60;  // 1秒冷却
        this.blockDuration = 0;
        this.maxBlockDuration = 180;  // 3秒最大持续时间
        this.blockHitParticles = [];  // 格挡粒子效果
        this.blockRingScale = 0;      // 格挡环形特效缩放
        this.blockFlashIntensity = 0; // 格挡闪光强度
    }

    draw(ctx) {
        // 更新显示位置
        this.displayY = this.isCrouching ? this.y + this.normalHeight/4 : this.y;
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        
        const currentHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
        const direction = this.facingLeft ? -1 : 1;

        // 画头（添加朝向标识）
        ctx.beginPath();
        ctx.arc(this.x, this.displayY - currentHeight/2, 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // 添加眼睛来表示朝向
        ctx.beginPath();
        ctx.arc(this.x + direction * 4, this.displayY - currentHeight/2 - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // 画身体
        ctx.beginPath();
        ctx.moveTo(this.x, this.displayY - currentHeight/2 + 10);
        ctx.lineTo(this.x, this.displayY + currentHeight/2);
        ctx.stroke();
        
        // 修改手臂绘制方法
        if (!this.isAttacking) {
            // 静止状态时手臂朝向
            ctx.beginPath();
            // 后臂
            ctx.moveTo(this.x, this.displayY);
            ctx.lineTo(this.x - direction * this.armLength, this.displayY + 5);
            // 前臂
            ctx.moveTo(this.x, this.displayY);
            ctx.lineTo(this.x + direction * this.armLength, this.displayY - 5);
            ctx.stroke();
        }
        
        // 修改攻击动画部分
        if (this.isAttacking) {
            switch(this.attackType) {
                case 'normal':
                    // 先画腿部
                    this.drawLegs(ctx, currentHeight);
                    
                    // 再画攻击动作
                    // 静止的手（后臂）
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.displayY);
                    ctx.lineTo(this.x - direction * this.armLength, this.displayY + 5);
                    ctx.stroke();
                    
                    // 攻击的手（前臂）
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.displayY);
                    const punchX = this.x + (this.armLength + this.punchExtension * this.punchPhase) * direction;
                    ctx.lineTo(punchX, this.displayY);
                    ctx.stroke();
                    
                    // 画拳头
                    ctx.beginPath();
                    ctx.arc(punchX, this.displayY, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                    
                case 'kick':
                    // 踢腿时手臂保持正常
                    ctx.beginPath();
                    // 后臂
                    ctx.moveTo(this.x, this.displayY);
                    ctx.lineTo(this.x - direction * this.armLength, this.displayY + 5);
                    // 前臂
                    ctx.moveTo(this.x, this.displayY);
                    ctx.lineTo(this.x + direction * this.armLength, this.displayY - 5);
                    ctx.stroke();
                    
                    // 一条腿踢出，一条腿支撑
                    const kickDirection = this.facingLeft ? -1 : 1;
                    
                    // 支撑腿
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.displayY + currentHeight/2);
                    ctx.lineTo(this.x - 10, this.displayY + currentHeight);
                    ctx.stroke();
                    
                    // 踢出的腿
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.displayY + currentHeight/2);
                    const kickX = this.x + (this.legLength + this.kickExtension * this.kickPhase) * kickDirection;
                    const kickY = this.displayY + currentHeight/2;
                    ctx.lineTo(kickX, kickY);
                    ctx.stroke();

                    // 画身体其他部分
                    this.drawHead(ctx, currentHeight);
                    this.drawBody(ctx, currentHeight);
                    break;
                    
                case 'skill':
                    // 技能攻击时保持正常姿势
                    ctx.beginPath();
                    // 手臂
                    ctx.moveTo(this.x - this.armLength, this.displayY);
                    ctx.lineTo(this.x + this.armLength, this.displayY);
                    ctx.stroke();
                    // 腿部
                    this.drawLegs(ctx, currentHeight);
                    break;
            }
        } else {
            // 非攻击状态的绘制保持不变
            this.drawLegs(ctx, currentHeight);
        }
        
        // 显示血量
        ctx.fillStyle = this.color;
        ctx.font = '12px Arial';
        ctx.fillText(`HP: ${this.health}`, this.x - 20, this.y - currentHeight - 10);

        if (this.isAttacking) {
            switch (this.attackType) {
                case 'normal':
                    // 普通拳击
                    ctx.beginPath();
                    ctx.arc(this.x + (this.facingLeft ? -25 : 25), this.y, 10, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                case 'kick':
                    // 腿部攻击
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y + 10);
                    ctx.lineTo(this.x + (this.facingLeft ? -30 : 30), this.y + 20);
                    ctx.stroke();
                    break;
                case 'skill':
                    // 技能效果
                    this.drawSkillEffect(ctx);
                    break;
            }
        }

        // 绘制格挡盾牌
        if (this.isBlocking) {
            const shieldX = this.x + (this.facingLeft ? -40 : 40);
            const shieldY = this.y;
            
            const radiusX = 25;
            const radiusY = 45;
            
            // 绘制格挡持续时间指示器
            const blockProgress = 1 - (this.blockDuration / this.maxBlockDuration);
            ctx.strokeStyle = `rgba(100, 150, 255, 0.5)`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(shieldX, shieldY - radiusY - 10, 5, 0, Math.PI * 2 * blockProgress);
            ctx.stroke();
            
            // 盾牌基础效果
            const gradient = ctx.createRadialGradient(
                shieldX, shieldY, 0,
                shieldX, shieldY, radiusX
            );
            
            if (this.blockHitEffect) {
                // 格挡命中时的增强效果
                const intensity = this.blockFlashIntensity;
                gradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 + intensity * 0.1})`);
                gradient.addColorStop(0.4, `rgba(100, 200, 255, ${0.7 + intensity * 0.3})`);
                gradient.addColorStop(1, `rgba(50, 100, 255, ${intensity * 0.5})`);
            } else {
                // 普通格挡状态
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
                gradient.addColorStop(0.4, 'rgba(100, 150, 255, 0.5)');
                gradient.addColorStop(1, 'rgba(50, 100, 255, 0)');
            }
            
            // 绘制椭圆形盾牌
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(shieldX, shieldY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // 绘制椭圆形能量环
            ctx.strokeStyle = this.blockHitEffect ? '#00ffff' : '#4444ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(shieldX, shieldY, radiusX - 5, radiusY - 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            // 绘制能量波纹
            for (let i = 0; i < 3; i++) {
                const time = Date.now() / 1000;
                const waveRadiusX = radiusX - 10 + Math.sin(time * 5 + i * 2) * 3;
                const waveRadiusY = radiusY - 10 + Math.sin(time * 5 + i * 2) * 3;
                ctx.strokeStyle = `rgba(100, 150, 255, ${0.5 - i * 0.15})`;
                ctx.beginPath();
                ctx.ellipse(shieldX, shieldY, waveRadiusX, waveRadiusY, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }

        // 绘制格挡特效
        if (this.blockHitParticles.length > 0) {
            ctx.save();
            this.blockHitParticles.forEach(particle => {
                const gradient = ctx.createRadialGradient(
                    particle.x, particle.y, 0,
                    particle.x, particle.y, particle.size * 2
                );
                gradient.addColorStop(0, `rgba(255, 255, 255, ${particle.life})`);
                gradient.addColorStop(0.4, `rgba(100, 200, 255, ${particle.life * 0.8})`);
                gradient.addColorStop(1, `rgba(50, 100, 255, ${particle.life * 0.3})`);
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        // 绘制格挡环形特效
        if (this.blockRingScale < 1) {
            ctx.save();
            const ringX = this.x + (this.facingLeft ? -40 : 40);
            const ringY = this.y;
            ctx.strokeStyle = `rgba(100, 200, 255, ${1 - this.blockRingScale})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ringX, ringY, 50 * this.blockRingScale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawSkillEffect(ctx) {
        if (!this.currentSkill) return;
        
        ctx.save();
        switch (this.currentSkill.name) {
            case 'fireball':
                this.projectiles.forEach(proj => {
                    // 火球核心
                    const gradient = ctx.createRadialGradient(
                        proj.x, proj.y, 0,
                        proj.x, proj.y, this.currentSkill.projectileSize
                    );
                    gradient.addColorStop(0, '#ffffff');
                    gradient.addColorStop(0.2, '#ffff00');
                    gradient.addColorStop(0.4, '#ff6600');
                    gradient.addColorStop(1, '#ff0000');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(proj.x, proj.y, this.currentSkill.projectileSize, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // 火焰尾迹
                    ctx.beginPath();
                    ctx.moveTo(proj.x, proj.y);
                    for(let i = 0; i < 3; i++) {
                        const curve1 = {
                            x: proj.x - (this.facingLeft ? 1 : -1) * (20 + i * 15),
                            y: proj.y + Math.sin(Date.now()/100 + i) * 20
                        };
                        const curve2 = {
                            x: proj.x - (this.facingLeft ? 1 : -1) * (40 + i * 15),
                            y: proj.y
                        };
                        ctx.quadraticCurveTo(curve1.x, curve1.y, curve2.x, curve2.y);
                    }
                    ctx.strokeStyle = '#ff3300';
                    ctx.lineWidth = 10;
                    ctx.stroke();
                });
                break;

            case 'tornado':
                const centerX = this.x + (this.facingLeft ? -150 : 150);
                const height = 300;
                
                for(let i = 0; i < 5; i++) {
                    const gradient = ctx.createLinearGradient(
                        centerX - 100, 0,
                        centerX + 100, 0
                    );
                    gradient.addColorStop(0, `rgba(150, 200, 255, ${0.3 + i * 0.15})`);
                    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.4 + i * 0.15})`);
                    gradient.addColorStop(1, `rgba(150, 200, 255, ${0.3 + i * 0.15})`);
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    
                    const time = Date.now() / 1000;
                    const spiralX = Math.sin(time * 5 + i) * (50 - i * 8);
                    ctx.moveTo(centerX + spiralX, this.y - height/2);
                    
                    for(let j = 0; j < 20; j++) {
                        const t = j / 19;
                        const x = centerX + Math.sin(time * 5 + i + t * 10) * (50 - i * 8);
                        const y = this.y - height/2 + height * t;
                        ctx.lineTo(x, y);
                    }
                    
                    ctx.fill();
                }
                break;
        }
        ctx.restore();
    }

    // 添加闪电绘制辅助方法
    drawLightning(ctx, x1, y1, x2, y2, displace) {
        if (displace < 2) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        } else {
            const mid = {
                x: (x1 + x2) / 2,
                y: (y1 + y2) / 2
            };
            mid.x += (Math.random() - 0.5) * displace * 2;
            mid.y += (Math.random() - 0.5) * displace * 2;
            
            this.drawLightning(ctx, x1, y1, mid.x, mid.y, displace / 2);
            this.drawLightning(ctx, mid.x, mid.y, x2, y2, displace / 2);
        }
    }

    jump() {
        if (this.onGround) {
            // 第一段跳
            this.velocityY = this.jumpStrength;
            this.onGround = false;
            this.jumpCount = 1;
            this.createJumpEffect();
        } else if (this.jumpCount < this.maxJumpCount) {
            // 二段跳
            this.velocityY = this.doubleJumpStrength;
            this.jumpCount++;
            
            // 二段跳特效
            for (let i = 0; i < 15; i++) {
                this.particles.push({
                    x: this.x,
                    y: this.y + this.height/2,
                    vx: (Math.random() - 0.5) * 10,
                    vy: Math.random() * 6 + 2,
                    life: 25,
                    color: this.color,
                    size: Math.random() * 4 + 2
                });
            }
        }
    }

    createJumpEffect() {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: this.x,
                y: this.y + this.height/2,
                vx: (Math.random() - 0.5) * 8,
                vy: Math.random() * 5 + 2,
                life: 20,
                color: this.color
            });
        }
    }

    updatePosition() {
        // 应用重力
        this.velocityY += this.gravity;
        this.y += this.velocityY;

        // 检查与所有平台的碰撞
        let isOnAnyPlatform = false;
        platforms.forEach(platform => {
            const isOverlappingX = this.x + this.width/2 >= platform.x && 
                                 this.x - this.width/2 <= platform.x + platform.width;
            
            // 检查是否正在下落
            if (this.velocityY >= 0) {
                // 如果正在下蹲，则忽略当前站立的平台的碰撞
                if (!this.isCrouching &&
                    this.y + this.height >= platform.y && 
                    this.y + this.height <= platform.y + platform.height &&
                    isOverlappingX) {
                    
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                    this.jumpCount = 0;
                    isOnAnyPlatform = true;
                    this.currentPlatform = platform;
                }
            }
        });

        if (!isOnAnyPlatform) {
            this.onGround = false;
            this.currentPlatform = null;
        }

        // 防止掉出地图底部
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocityY = 0;
            this.onGround = true;
            this.jumpCount = 0;
            this.currentPlatform = null;
        }
    }

    attack(target, type = 'normal') {
        if (this.attackCooldown > 0) return;

        this.attackType = type;
        this.isAttacking = true;
        
        let damage = 10;
        let cooldown = 20;
        let range = this.attackRange[type] || 50;
        let targetInRange = false;

        // 检查目标是否在格挡
        if (target.isBlocking) {
            const attackerToTarget = target.x - this.x;  // 正值表示目标在攻击者右边
            const attackFromBehind = (attackerToTarget > 0 && !target.facingLeft) || 
                                   (attackerToTarget < 0 && target.facingLeft);
            
            // 如果是从背后攻击，直接造成伤害
            if (attackFromBehind) {
                // 继续执行攻击逻辑，不触发格挡
            } else {
                // 从正面攻击且目标正在格挡，触发格挡效果
                target.createBlockHitEffect();
                setTimeout(() => {
                    target.blockFlashIntensity = 0;
                }, 200);
                
                // 设置攻击冷却并结束攻击
                this.attackCooldown = cooldown;
                setTimeout(() => {
                    this.isAttacking = false;
                    this.punchPhase = 0;
                    this.kickPhase = 0;
                }, 300);
                return; // 攻击被格挡
            }
        }

        switch (type) {
            case 'normal':
                damage = 10;
                cooldown = 15;
                // 拳击动画
                this.punchPhase = 0;
                const punchAnimation = setInterval(() => {
                    this.punchPhase += 0.2;
                    if (this.punchPhase >= 1) {
                        clearInterval(punchAnimation);
                    }
                }, 16);
                targetInRange = Math.abs(this.x - target.x) < this.attackRange.normal;
                break;
                
            case 'kick':
                damage = 15;
                cooldown = 25;
                // 踢腿动画
                this.kickPhase = 0;
                const kickAnimation = setInterval(() => {
                    this.kickPhase += 0.15;
                    if (this.kickPhase >= 1) {
                        clearInterval(kickAnimation);
                    }
                }, 16);
                targetInRange = Math.abs(this.x - target.x) < this.attackRange.kick;
                break;

            case 'skill':
                if (this.currentSkill) {
                    damage = this.currentSkill.damage;
                    cooldown = this.currentSkill.cooldown;
                    range = this.currentSkill.range;

                    const direction = this.facingLeft ? -1 : 1;
                    
                    switch (this.currentSkill.name) {
                        case 'fireball':
                            this.projectiles.push({
                                x: this.x + (this.facingLeft ? -30 : 30),
                                y: this.y,
                                speed: this.currentSkill.projectileSpeed * direction,
                                damage: damage,
                                hit: false
                            });
                            break;
                            
                        case 'tornado':
                            const hitX = this.x + (direction * this.currentSkill.range/2);
                            const distanceToTarget = Math.abs(hitX - target.x);
                            
                            if (distanceToTarget < this.currentSkill.hitWidth && !target.isBlocking) {
                                target.health -= damage;
                            }
                            break;
                    }
                }
                break;
        }

        // 普通攻击和踢腿的伤害判定
        if ((type === 'normal' || type === 'kick') && targetInRange) {
            const attackDirection = this.facingLeft ? -1 : 1;
            const targetDirection = target.x - this.x;
            
            // 只有当攻击方向正确时才造成伤害
            if ((attackDirection === -1 && targetDirection < 0) || 
                (attackDirection === 1 && targetDirection > 0)) {
                target.health -= damage;
            }
        }

        this.attackCooldown = cooldown;
        
        // 攻击动画结束后重置状态
        setTimeout(() => {
            this.isAttacking = false;
            this.punchPhase = 0;
            this.kickPhase = 0;
        }, 300);
    }

    update() {
        this.updatePosition();
        if (this.attackCooldown > 0) this.attackCooldown--;
        
        // 更新火球位置和伤害判定
        this.projectiles = this.projectiles.filter(proj => {
            proj.x += proj.speed;
            
            // 检查火球是否击中目标
            if (!proj.hit && 
                Math.abs(proj.x - (this.isPlayer ? player2.x : player.x)) < this.currentSkill.hitWidth &&
                Math.abs(proj.y - (this.isPlayer ? player2.y : player.y)) < this.currentSkill.hitWidth) {
                
                if (this.isPlayer) {
                    player2.health -= proj.damage;
                } else {
                    player.health -= proj.damage;
                }
                proj.hit = true;
            }
            
            return Math.abs(proj.x - this.x) < this.currentSkill.range;
        });

        // 只保留一个格挡冷却更新逻辑
        if (this.blockCooldown > 0) {
            this.blockCooldown--;
        }
        
        if (this.blockFlashIntensity > 0) {
            this.blockFlashIntensity -= 0.1;
        }

        // 更新格挡粒子
        this.blockHitParticles = this.blockHitParticles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.3;  // 增加重力效果
            particle.life -= 0.03;  // 降低消失速度
            return particle.life > 0;
        });

        // 更新环形特效
        if (this.blockRingScale < 1) {
            this.blockRingScale += 0.15;  // 加快环形扩散速度
        }
    }

    // 辅助方法：绘制腿部
    drawLegs(ctx, currentHeight) {
        if (this.isCrouching) {
            // 下蹲时腿部弯曲
            ctx.beginPath();
            ctx.moveTo(this.x, this.displayY + currentHeight/2);
            ctx.quadraticCurveTo(
                this.x - 10, 
                this.displayY + currentHeight/2 + 5, 
                this.x - 5, 
                this.displayY + currentHeight
            );
            ctx.moveTo(this.x, this.displayY + currentHeight/2);
            ctx.quadraticCurveTo(
                this.x + 10, 
                this.displayY + currentHeight/2 + 5, 
                this.x + 5, 
                this.displayY + currentHeight
            );
            ctx.stroke();
        } else {
            // 正常站立时的腿
            ctx.beginPath();
            ctx.moveTo(this.x, this.displayY + currentHeight/2);
            ctx.lineTo(this.x - 10, this.displayY + currentHeight);
            ctx.moveTo(this.x, this.displayY + currentHeight/2);
            ctx.lineTo(this.x + 10, this.displayY + currentHeight);
            ctx.stroke();
        }
    }

    // 修改格挡方法
    block() {
        if (this.blockCooldown <= 0 && this.blockDuration < this.maxBlockDuration) {
            this.isBlocking = true;
            this.blockDuration++;
        }
        
        // 如果超过最大持续时间，强制结束格挡
        if (this.blockDuration >= this.maxBlockDuration) {
            this.stopBlock();
        }
    }

    // 修改停止格挡方法
    stopBlock() {
        if (this.isBlocking) {
            this.isBlocking = false;
            this.blockDuration = 0;
            this.blockCooldown = this.blockCooldownTime;
        }
    }

    // 添加辅助方法来绘制头部
    drawHead(ctx, currentHeight) {
        // 画头
        ctx.beginPath();
        ctx.arc(this.x, this.displayY - currentHeight/2, 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // 添加眼睛来表示朝向
        const direction = this.facingLeft ? -1 : 1;
        ctx.beginPath();
        ctx.arc(this.x + direction * 4, this.displayY - currentHeight/2 - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // 添加辅助方法来绘制身体
    drawBody(ctx, currentHeight) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.displayY - currentHeight/2 + 10);
        ctx.lineTo(this.x, this.displayY + currentHeight/2);
        ctx.stroke();
    }

    // 修改格挡命中特效方法
    createBlockHitEffect() {
        // 创建散射粒子
        for (let i = 0; i < 15; i++) {
            const angle = (Math.random() * Math.PI) - Math.PI/2;
            const speed = Math.random() * 12 + 6;  // 增加粒子速度
            const size = Math.random() * 3 + 2;    // 随机粒子大小
            this.blockHitParticles.push({
                x: this.x + (this.facingLeft ? -40 : 40),
                y: this.y,
                vx: Math.cos(angle) * speed * (this.facingLeft ? -1 : 1),
                vy: Math.sin(angle) * speed,
                size: size,
                life: 1.0
            });
        }
        
        // 重置环形特效
        this.blockRingScale = 0;
        this.blockFlashIntensity = 1.5;  // 增强闪光效果
        
        // 播放格挡音效（使用更响亮的音效）
        try {
            const audio = new Audio();
            audio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==';
            audio.volume = 0.3;
            audio.play();
        } catch (e) {
            console.log("Audio play failed:", e);
        }
    }
}

// 初始化游戏
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 修改画布尺寸
canvas.width = 1600;
canvas.height = 800;

// 创建随机平台
const platforms = [
    new Platform(0, canvas.height - 20, canvas.width, 20) // 地面
];

// 生成合理高度的平台
function generatePlatforms() {
    const minHeight = canvas.height - 200; // 最低平台高度
    const maxJumpHeight = 120; // 最大跳跃高度（根据角色跳跃能力调整）
    let lastPlatformY = canvas.height - 50; // 从地面附近开始生成

    // 生成8-12个平台
    const platformCount = Math.floor(Math.random() * 5) + 8;
    
    // 确保平台分布均匀
    const heightSections = (lastPlatformY - 150) / (platformCount - 1);
    
    for (let i = 0; i < platformCount; i++) {
        // 在每个高度区间内随机生成平台
        const minY = lastPlatformY - maxJumpHeight;
        const maxY = Math.max(150, lastPlatformY - 40); // 确保最小高度不低于150
        const platformY = Math.random() * (maxY - minY) + minY;
        
        // 平台宽度和位置
        const platformWidth = Math.random() * 100 + 200; // 增加平台宽度
        const platformX = Math.random() * (canvas.width - platformWidth);

        platforms.push(new Platform(
            platformX,
            platformY,
            platformWidth,
            20
        ));

        lastPlatformY = platformY;
    }
}

generatePlatforms();

const player = new StickMan(200, 200, 'blue', true);
const player2 = new StickMan(600, 200, 'red', false);

// 键盘控制
const keys = {};
const pressedKeys = new Set(); // 用于追踪按下但未释放的键

document.addEventListener('keydown', (e) => {
    // 如果键未被按下，则记录为新按下的键
    if (!keys[e.key]) {
        pressedKeys.add(e.key);
    }
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    pressedKeys.delete(e.key); // 移除释放的键
});

// 游戏主循环
function gameLoop() {
    if (gameState !== 'playing') return;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制所有平台
    platforms.forEach(platform => platform.draw(ctx));
    
    // 玩家1控制 (WASD + JKL)
    if (pressedKeys.has('w')) {
        player.jump();
    }
    if (keys['s']) {
        player.isCrouching = true;
    } else {
        player.isCrouching = false;
    }
    if (keys['a']) {
        player.x -= player.speed;
        player.facingLeft = true;
    }
    if (keys['d']) {
        player.x += player.speed;
        player.facingLeft = false;
    }
    if (keys['j']) player.attack(player2, 'normal');
    if (keys['k']) player.attack(player2, 'kick');
    if (keys['l']) {
        player.attack(player2, 'skill');
    }

    // 玩家2控制 (方向键 + 123)
    if (pressedKeys.has('ArrowUp')) {
        player2.jump();
    }
    if (keys['ArrowDown']) {
        player2.isCrouching = true;
    } else {
        player2.isCrouching = false;
    }
    if (keys['ArrowLeft']) {
        player2.x -= player2.speed;
        player2.facingLeft = true;
    }
    if (keys['ArrowRight']) {
        player2.x += player2.speed;
        player2.facingLeft = false;
    }
    if (keys['1']) player2.attack(player, 'normal');
    if (keys['2']) player2.attack(player, 'kick');
    if (keys['3']) {
        player2.attack(player, 'skill');
    }

    // 玩家1格挡控制
    if (keys['i']) {
        player.block();
    } else {
        player.stopBlock();
    }
    
    // 玩家2格挡控制
    if (keys['5']) {
        player2.block();
    } else {
        player2.stopBlock();
    }

    // 更新双方状态
    player.update();
    player2.update();
    
    // 边界检查
    player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
    player2.x = Math.max(20, Math.min(canvas.width - 20, player2.x));
    
    // 相机跟随（跟随两个玩家的中点）
    const centerX = (player.x + player2.x) / 2;
    const cameraX = Math.max(0, Math.min(centerX - canvas.width/2, 
        canvas.width - canvas.width));
    ctx.save();
    ctx.translate(-cameraX, 0);
    
    // 绘制角色
    player.draw(ctx);
    player2.draw(ctx);
    
    ctx.restore();
    
    // 检查游戏结束
    if (player.health <= 0 || player2.health <= 0) {
        gameState = 'gameover';
        const winner = player.health <= 0 ? "玩家2获胜！" : "玩家1获胜！";
        ctx.fillStyle = 'black';
        ctx.font = '48px Arial';
        ctx.fillText(winner, canvas.width/2 - 100, canvas.height/2);
        
        menuOverlay.style.display = 'flex';
        startButton.style.display = 'none';
        restartButton.style.display = 'block';
        return;
    }
    
    // 清除本帧处理过的按键
    pressedKeys.clear();
    
    requestAnimationFrame(gameLoop);
}

// 初始化时设置基准Y坐标
player.baseY = player.y;
player2.baseY = player2.y;

// 开始游戏
gameLoop(); 