// Behaviors - Düşman davranış ağacı sistemi
// Behavior Tree implementasyonu

import { getPathfinder, followPath, hasLineOfSight } from './pathfinder.js';
import { game } from '../../core/game.js';

// ============================================
// BEHAVIOR TREE NODE TYPES
// ============================================

/**
 * Behavior Tree Node durumları
 */
export const NodeStatus = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    RUNNING: 'running'
};

/**
 * Base Node sınıfı
 */
class BTNode {
    execute(entity, context) {
        return NodeStatus.FAILURE;
    }
}

/**
 * Sequence Node - Tüm çocuklar başarılı olmalı
 */
class Sequence extends BTNode {
    constructor(children) {
        super();
        this.children = children;
    }

    execute(entity, context) {
        for (const child of this.children) {
            const status = child.execute(entity, context);
            if (status !== NodeStatus.SUCCESS) {
                return status;
            }
        }
        return NodeStatus.SUCCESS;
    }
}

/**
 * Selector Node - İlk başarılı çocuk yeterli
 */
class Selector extends BTNode {
    constructor(children) {
        super();
        this.children = children;
    }

    execute(entity, context) {
        for (const child of this.children) {
            const status = child.execute(entity, context);
            if (status !== NodeStatus.FAILURE) {
                return status;
            }
        }
        return NodeStatus.FAILURE;
    }
}

/**
 * Condition Node - Koşul kontrolü
 */
class Condition extends BTNode {
    constructor(conditionFn) {
        super();
        this.conditionFn = conditionFn;
    }

    execute(entity, context) {
        return this.conditionFn(entity, context)
            ? NodeStatus.SUCCESS
            : NodeStatus.FAILURE;
    }
}

/**
 * Action Node - Aksiyon çalıştırma
 */
class Action extends BTNode {
    constructor(actionFn) {
        super();
        this.actionFn = actionFn;
    }

    execute(entity, context) {
        return this.actionFn(entity, context);
    }
}

/**
 * Inverter Node - Sonucu tersine çevir
 */
class Inverter extends BTNode {
    constructor(child) {
        super();
        this.child = child;
    }

    execute(entity, context) {
        const status = this.child.execute(entity, context);
        if (status === NodeStatus.SUCCESS) return NodeStatus.FAILURE;
        if (status === NodeStatus.FAILURE) return NodeStatus.SUCCESS;
        return status;
    }
}

/**
 * Repeater Node - Başarısız olana kadar tekrarla
 */
class Repeater extends BTNode {
    constructor(child, maxRepeats = Infinity) {
        super();
        this.child = child;
        this.maxRepeats = maxRepeats;
    }

    execute(entity, context) {
        let count = 0;
        while (count < this.maxRepeats) {
            const status = this.child.execute(entity, context);
            if (status === NodeStatus.FAILURE) return NodeStatus.FAILURE;
            if (status === NodeStatus.RUNNING) return NodeStatus.RUNNING;
            count++;
        }
        return NodeStatus.SUCCESS;
    }
}

// ============================================
// CONDITION FUNCTIONS
// ============================================

const conditions = {
    canSeePlayer: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return false;

        const dx = player.x - entity.x;
        const dy = player.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Mesafe kontrolü
        const viewRange = entity.viewRange || 12;
        if (dist > viewRange) return false;

        // Görüş hattı kontrolü
        return hasLineOfSight(ctx.map, entity.x, entity.y, player.x, player.y);
    },

    isInAttackRange: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return false;

        const dx = player.x - entity.x;
        const dy = player.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return dist <= entity.attackRange;
    },

    healthAbove: (threshold) => (entity, ctx) => {
        return entity.health > entity.maxHealth * threshold;
    },

    healthBelow: (threshold) => (entity, ctx) => {
        return entity.health <= entity.maxHealth * threshold;
    },

    hasPath: (entity, ctx) => {
        return entity.path && entity.path.length > 0;
    },

    isAlert: (entity, ctx) => {
        return entity.isAlert === true;
    },

    canAttack: (entity, ctx) => {
        const now = performance.now() / 1000;
        return (now - entity.lastAttackTime) >= entity.attackRate;
    },

    isCloaked: (entity, ctx) => {
        return entity.isCloaked === true;
    },

    cloakReady: (entity, ctx) => {
        if (!entity.cloakCooldown) return true;
        const now = performance.now() / 1000;
        return (now - (entity.lastCloakTime || 0)) >= entity.cloakCooldown;
    }
};

// ============================================
// ACTION FUNCTIONS
// ============================================

const actions = {
    // Oyuncuya doğru hareket et
    moveToPlayer: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return NodeStatus.FAILURE;

        const pathfinder = getPathfinder();
        const map = ctx.map;

        // Yol hesapla (cache kullanır)
        if (!entity.path || entity.pathRecalcTime === undefined ||
            performance.now() - entity.pathRecalcTime > 500) {
            entity.path = pathfinder.findPath(map, entity.x, entity.y, player.x, player.y);
            entity.pathRecalcTime = performance.now();
            entity.pathIndex = 0;
        }

        if (!entity.path) {
            // Yol bulunamadı, direkt git
            return actions.moveDirectToPlayer(entity, ctx);
        }

        // Yolu takip et
        const target = followPath(entity, entity.path);
        if (!target) return NodeStatus.SUCCESS;

        // Hareketi uygula
        const dx = target.x - entity.x;
        const dy = target.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.1) {
            const dirX = dx / dist;
            const dirY = dy / dist;

            const moveX = dirX * entity.speed * ctx.deltaTime;
            const moveY = dirY * entity.speed * ctx.deltaTime;

            // Collision check
            if (!map.isWall(Math.floor(entity.x + moveX), Math.floor(entity.y))) {
                entity.x += moveX;
            }
            if (!map.isWall(Math.floor(entity.x), Math.floor(entity.y + moveY))) {
                entity.y += moveY;
            }

            // Yüzü hedefe dön
            entity.angle = Math.atan2(dy, dx);
        }

        return NodeStatus.RUNNING;
    },

    // Direkt oyuncuya doğru git (pathfinding olmadan)
    moveDirectToPlayer: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return NodeStatus.FAILURE;

        const dx = player.x - entity.x;
        const dy = player.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.1) return NodeStatus.SUCCESS;

        const dirX = dx / dist;
        const dirY = dy / dist;

        const moveX = dirX * entity.speed * ctx.deltaTime;
        const moveY = dirY * entity.speed * ctx.deltaTime;

        const map = ctx.map;
        if (!map.isWall(Math.floor(entity.x + moveX), Math.floor(entity.y))) {
            entity.x += moveX;
        }
        if (!map.isWall(Math.floor(entity.x), Math.floor(entity.y + moveY))) {
            entity.y += moveY;
        }

        entity.angle = Math.atan2(dy, dx);
        return NodeStatus.RUNNING;
    },

    // Saldır
    attack: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return NodeStatus.FAILURE;

        const now = performance.now() / 1000;
        if (now - entity.lastAttackTime < entity.attackRate) {
            return NodeStatus.RUNNING;
        }

        entity.lastAttackTime = now;

        // Görüş hattı kontrolü
        if (!hasLineOfSight(ctx.map, entity.x, entity.y, player.x, player.y)) {
            return NodeStatus.FAILURE;
        }

        // Hasar ver
        player.health -= entity.damage;
        game.damageFlash = { time: 0.3, intensity: 0.5 };

        if (player.health <= 0) {
            player.health = 0;
            game.isGameOver = true;
        }

        return NodeStatus.SUCCESS;
    },

    // Oyuncuya bak
    facePlayer: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return NodeStatus.FAILURE;

        const dx = player.x - entity.x;
        const dy = player.y - entity.y;
        entity.angle = Math.atan2(dy, dx);

        return NodeStatus.SUCCESS;
    },

    // Rastgele dolaş (patrol)
    patrol: (entity, ctx) => {
        const map = ctx.map;

        // Yeni hedef seç
        if (!entity.patrolTarget || entity.patrolReached) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 2 + Math.random() * 4;
            const newX = entity.x + Math.cos(angle) * dist;
            const newY = entity.y + Math.sin(angle) * dist;

            // Geçerli hedef mi?
            if (!map.isWall(Math.floor(newX), Math.floor(newY))) {
                entity.patrolTarget = { x: newX, y: newY };
                entity.patrolReached = false;
            } else {
                return NodeStatus.RUNNING;
            }
        }

        // Hedefe git
        const dx = entity.patrolTarget.x - entity.x;
        const dy = entity.patrolTarget.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.5) {
            entity.patrolReached = true;
            return NodeStatus.SUCCESS;
        }

        const dirX = dx / dist;
        const dirY = dy / dist;

        // Yavaş hareket (patrol)
        const patrolSpeed = entity.speed * 0.4;
        const moveX = dirX * patrolSpeed * ctx.deltaTime;
        const moveY = dirY * patrolSpeed * ctx.deltaTime;

        if (!map.isWall(Math.floor(entity.x + moveX), Math.floor(entity.y))) {
            entity.x += moveX;
        }
        if (!map.isWall(Math.floor(entity.x), Math.floor(entity.y + moveY))) {
            entity.y += moveY;
        }

        entity.angle = Math.atan2(dy, dx);
        return NodeStatus.RUNNING;
    },

    // Geri çekil
    retreat: (entity, ctx) => {
        const player = ctx.player;
        if (!player) return NodeStatus.FAILURE;

        // Oyuncudan uzaklaş
        const dx = entity.x - player.x;
        const dy = entity.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 8) return NodeStatus.SUCCESS;

        const dirX = dx / dist;
        const dirY = dy / dist;

        const moveX = dirX * entity.speed * ctx.deltaTime;
        const moveY = dirY * entity.speed * ctx.deltaTime;

        const map = ctx.map;
        if (!map.isWall(Math.floor(entity.x + moveX), Math.floor(entity.y))) {
            entity.x += moveX;
        }
        if (!map.isWall(Math.floor(entity.x), Math.floor(entity.y + moveY))) {
            entity.y += moveY;
        }

        // Oyuncuya bak
        entity.angle = Math.atan2(-dy, -dx);
        return NodeStatus.RUNNING;
    },

    // Cloak (görünmez ol)
    activateCloak: (entity, ctx) => {
        const now = performance.now() / 1000;
        if (entity.cloakCooldown && (now - (entity.lastCloakTime || 0)) < entity.cloakCooldown) {
            return NodeStatus.FAILURE;
        }

        entity.isCloaked = true;
        entity.cloakEndTime = now + (entity.cloakDuration || 3);
        entity.lastCloakTime = now;
        return NodeStatus.SUCCESS;
    },

    // Cloak kontrolü
    updateCloak: (entity, ctx) => {
        if (!entity.isCloaked) return NodeStatus.SUCCESS;

        const now = performance.now() / 1000;
        if (now >= entity.cloakEndTime) {
            entity.isCloaked = false;
        }
        return NodeStatus.SUCCESS;
    },

    // Alert ol
    becomeAlert: (entity, ctx) => {
        entity.isAlert = true;
        entity.state = 'chase';
        return NodeStatus.SUCCESS;
    },

    // Idle durumunda bekle
    idle: (entity, ctx) => {
        // Bazen etrafına bak
        if (Math.random() < 0.01) {
            entity.angle += (Math.random() - 0.5) * 0.5;
        }
        return NodeStatus.SUCCESS;
    }
};

// ============================================
// BEHAVIOR TREE BUILDERS
// ============================================

/**
 * Grunt için behavior tree
 */
export function createGruntBehavior() {
    return new Selector([
        // Savaş modu
        new Sequence([
            new Condition(conditions.isAlert),
            new Selector([
                // Saldırı menzilindeyse saldır
                new Sequence([
                    new Condition(conditions.isInAttackRange),
                    new Condition(conditions.canAttack),
                    new Action(actions.attack)
                ]),
                // Değilse yaklaş
                new Action(actions.moveToPlayer)
            ])
        ]),
        // Idle/Patrol modu
        new Selector([
            new Sequence([
                new Condition(conditions.canSeePlayer),
                new Action(actions.becomeAlert)
            ]),
            new Action(actions.patrol)
        ])
    ]);
}

/**
 * Shooter için behavior tree
 */
export function createShooterBehavior() {
    return new Selector([
        // Savaş modu
        new Sequence([
            new Condition(conditions.isAlert),
            new Action(actions.facePlayer),
            new Selector([
                // Menzilde ve görüş hattı varsa saldır
                new Sequence([
                    new Condition(conditions.canSeePlayer),
                    new Condition(conditions.canAttack),
                    new Action(actions.attack)
                ]),
                // Görüş hattı yoksa yaklaş
                new Sequence([
                    new Inverter(new Condition(conditions.canSeePlayer)),
                    new Action(actions.moveToPlayer)
                ]),
                // Çok yakınsa geri çekil
                new Sequence([
                    new Condition((e, ctx) => {
                        const p = ctx.player;
                        if (!p) return false;
                        const d = Math.hypot(p.x - e.x, p.y - e.y);
                        return d < 3;
                    }),
                    new Action(actions.retreat)
                ])
            ])
        ]),
        // Idle/Patrol
        new Selector([
            new Sequence([
                new Condition(conditions.canSeePlayer),
                new Action(actions.becomeAlert)
            ]),
            new Action(actions.idle)
        ])
    ]);
}

/**
 * Charger için behavior tree
 */
export function createChargerBehavior() {
    return new Selector([
        // Savaş modu - agresif
        new Sequence([
            new Condition(conditions.isAlert),
            new Selector([
                // Saldırı menzilindeyse saldır
                new Sequence([
                    new Condition(conditions.isInAttackRange),
                    new Condition(conditions.canAttack),
                    new Action(actions.attack)
                ]),
                // Değilse direkt koş (pathfinding yok, hız için)
                new Action(actions.moveDirectToPlayer)
            ])
        ]),
        // Görünce hemen alert ol
        new Sequence([
            new Condition(conditions.canSeePlayer),
            new Action(actions.becomeAlert)
        ]),
        new Action(actions.patrol)
    ]);
}

/**
 * Sniper için behavior tree
 */
export function createSniperBehavior() {
    return new Selector([
        // Savaş modu
        new Sequence([
            new Condition(conditions.isAlert),
            new Action(actions.facePlayer),
            new Selector([
                // Uzaktan ateş et
                new Sequence([
                    new Condition(conditions.canSeePlayer),
                    new Condition(conditions.canAttack),
                    new Action(actions.attack)
                ]),
                // Çok yakınsa geri çekil
                new Sequence([
                    new Condition((e, ctx) => {
                        const p = ctx.player;
                        if (!p) return false;
                        const d = Math.hypot(p.x - e.x, p.y - e.y);
                        return d < 5;
                    }),
                    new Action(actions.retreat)
                ]),
                // Görüş hattı yoksa pozisyon değiştir
                new Sequence([
                    new Inverter(new Condition(conditions.canSeePlayer)),
                    new Action(actions.moveToPlayer)
                ])
            ])
        ]),
        // Idle - sabit dur, etrafı izle
        new Selector([
            new Sequence([
                new Condition(conditions.canSeePlayer),
                new Action(actions.becomeAlert)
            ]),
            new Action(actions.idle)
        ])
    ]);
}

/**
 * Tank için behavior tree
 */
export function createTankBehavior() {
    return new Selector([
        // Savaş modu - yavaş ama kararlı
        new Sequence([
            new Condition(conditions.isAlert),
            new Selector([
                // Menzildeyse saldır
                new Sequence([
                    new Condition(conditions.isInAttackRange),
                    new Condition(conditions.canAttack),
                    new Action(actions.attack)
                ]),
                // Değilse yavaşça yaklaş
                new Action(actions.moveToPlayer)
            ])
        ]),
        // Idle
        new Selector([
            new Sequence([
                new Condition(conditions.canSeePlayer),
                new Action(actions.becomeAlert)
            ]),
            new Action(actions.idle)
        ])
    ]);
}

/**
 * Ninja için behavior tree
 */
export function createNinjaBehavior() {
    return new Selector([
        // Cloak güncelle
        new Action(actions.updateCloak),
        // Savaş modu
        new Sequence([
            new Condition(conditions.isAlert),
            new Selector([
                // Görünmez saldırı
                new Sequence([
                    new Condition(conditions.isCloaked),
                    new Condition(conditions.isInAttackRange),
                    new Action(actions.attack),
                    new Action((e) => { e.isCloaked = false; return NodeStatus.SUCCESS; })
                ]),
                // Menzildeyse saldır
                new Sequence([
                    new Condition(conditions.isInAttackRange),
                    new Condition(conditions.canAttack),
                    new Action(actions.attack)
                ]),
                // Cloak aktifse yaklaş
                new Sequence([
                    new Condition(conditions.isCloaked),
                    new Action(actions.moveDirectToPlayer)
                ]),
                // Cloak hazırsa aktifle ve yaklaş
                new Sequence([
                    new Condition(conditions.cloakReady),
                    new Action(actions.activateCloak),
                    new Action(actions.moveDirectToPlayer)
                ]),
                // Normal yaklaşma
                new Action(actions.moveToPlayer)
            ])
        ]),
        // Idle - görünce hemen cloak ve saldır
        new Sequence([
            new Condition(conditions.canSeePlayer),
            new Action(actions.becomeAlert)
        ]),
        new Action(actions.patrol)
    ]);
}

// ============================================
// BEHAVIOR TREE MAPPING
// ============================================

const behaviorMap = {
    grunt: createGruntBehavior,
    shooter: createShooterBehavior,
    charger: createChargerBehavior,
    sniper: createSniperBehavior,
    tank: createTankBehavior,
    ninja: createNinjaBehavior
};

/**
 * Düşman tipi için behavior tree al
 */
export function getBehaviorTree(enemyType) {
    const factory = behaviorMap[enemyType];
    if (factory) {
        return factory();
    }
    // Varsayılan: grunt davranışı
    return createGruntBehavior();
}

/**
 * Behavior tree çalıştır
 */
export function executeBehavior(entity, context) {
    if (!entity.behaviorTree) {
        entity.behaviorTree = getBehaviorTree(entity.type);
    }

    return entity.behaviorTree.execute(entity, context);
}
