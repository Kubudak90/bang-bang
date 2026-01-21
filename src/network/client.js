// Client - WebSocket game client
// Handles server connection, message routing, and reconnection

import {
    C2S, S2C, NETWORK,
    encodeMessage, decodeMessage,
    createJoinMessage, createInputMessage, createPingMessage, createShootMessage
} from './protocol.js';

// ============================================
// GAME CLIENT CLASS
// ============================================

export class GameClient {
    constructor() {
        this.ws = null;
        this.serverUrl = null;
        this.isConnected = false;
        this.isConnecting = false;

        // Player info
        this.playerId = null;
        this.roomId = null;
        this.farcasterUser = null;

        // Latency tracking
        this.ping = 0;
        this.lastPingTime = 0;
        this.pingInterval = null;

        // Input tracking
        this.inputSequence = 0;
        this.lastProcessedInput = 0;

        // Event callbacks
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onJoined: null,
            onStateUpdate: null,
            onPlayerJoin: null,
            onPlayerLeave: null,
            onHit: null,
            onKill: null,
            onRespawn: null,
            onMatchStart: null,
            onMatchEnd: null,
            onError: null
        };

        // Reconnection
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    // ============================================
    // CONNECTION
    // ============================================

    /**
     * Connect to game server
     */
    connect(serverUrl, farcasterUser) {
        if (this.isConnected || this.isConnecting) {
            console.warn('Already connected or connecting');
            return;
        }

        this.serverUrl = serverUrl;
        this.farcasterUser = farcasterUser;
        this.isConnecting = true;

        console.log(`Connecting to ${serverUrl}...`);

        try {
            this.ws = new WebSocket(serverUrl);
            this.ws.onopen = () => this._onOpen();
            this.ws.onclose = (e) => this._onClose(e);
            this.ws.onerror = (e) => this._onError(e);
            this.ws.onmessage = (e) => this._onMessage(e);
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.isConnecting = false;
            this._scheduleReconnect();
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        this.isConnecting = false;
        this.playerId = null;
        this.roomId = null;
    }

    // ============================================
    // MESSAGE SENDING
    // ============================================

    /**
     * Send raw message
     */
    _send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message);
            return true;
        }
        return false;
    }

    /**
     * Send player input
     */
    sendInput(input) {
        if (!this.isConnected) return;

        const inputWithSeq = {
            ...input,
            seq: ++this.inputSequence
        };

        this._send(createInputMessage(inputWithSeq));

        return inputWithSeq.seq;
    }

    /**
     * Send shoot action
     */
    sendShoot(angle, weapon) {
        if (!this.isConnected) return;
        this._send(createShootMessage(angle, weapon));
    }

    /**
     * Send weapon switch
     */
    sendWeaponSwitch(weapon) {
        if (!this.isConnected) return;
        this._send(encodeMessage(C2S.SWITCH_WEAPON, { w: weapon }));
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================

    _onOpen() {
        console.log('Connected to server');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Send join request
        if (this.farcasterUser) {
            this._send(createJoinMessage(
                this.farcasterUser.fid,
                this.farcasterUser.username,
                this.farcasterUser.displayName
            ));
        }

        // Start ping interval
        this.pingInterval = setInterval(() => {
            this.lastPingTime = Date.now();
            this._send(createPingMessage());
        }, 2000);

        if (this.callbacks.onConnect) {
            this.callbacks.onConnect();
        }
    }

    _onClose(event) {
        console.log('Disconnected from server:', event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect(event.code, event.reason);
        }

        // Attempt reconnection
        if (event.code !== 1000) { // Not a clean close
            this._scheduleReconnect();
        }
    }

    _onError(error) {
        console.error('WebSocket error:', error);

        if (this.callbacks.onError) {
            this.callbacks.onError(error);
        }
    }

    _onMessage(event) {
        const msg = decodeMessage(event.data);
        if (!msg) return;

        switch (msg.type) {
            case S2C.JOINED:
                this._handleJoined(msg.payload);
                break;

            case S2C.STATE:
                this._handleStateUpdate(msg.payload);
                break;

            case S2C.PLAYER_JOIN:
                this._handlePlayerJoin(msg.payload);
                break;

            case S2C.PLAYER_LEAVE:
                this._handlePlayerLeave(msg.payload);
                break;

            case S2C.HIT:
                this._handleHit(msg.payload);
                break;

            case S2C.KILL:
                this._handleKill(msg.payload);
                break;

            case S2C.RESPAWN:
                this._handleRespawn(msg.payload);
                break;

            case S2C.MATCH_START:
                this._handleMatchStart(msg.payload);
                break;

            case S2C.MATCH_END:
                this._handleMatchEnd(msg.payload);
                break;

            case S2C.PING:
                this.ping = Date.now() - this.lastPingTime;
                break;

            case S2C.ERROR:
                console.error('Server error:', msg.payload);
                if (this.callbacks.onError) {
                    this.callbacks.onError(msg.payload);
                }
                break;
        }
    }

    // ============================================
    // MESSAGE HANDLERS
    // ============================================

    _handleJoined(data) {
        this.playerId = data.playerId;
        this.roomId = data.roomId;

        console.log(`Joined room ${this.roomId} as player ${this.playerId}`);

        if (this.callbacks.onJoined) {
            this.callbacks.onJoined({
                playerId: data.playerId,
                roomId: data.roomId,
                mapSeed: data.mapSeed,
                players: data.players
            });
        }
    }

    _handleStateUpdate(data) {
        // Track which input server has processed
        if (data.lastInput) {
            this.lastProcessedInput = data.lastInput;
        }

        if (this.callbacks.onStateUpdate) {
            this.callbacks.onStateUpdate(data);
        }
    }

    _handlePlayerJoin(data) {
        console.log(`Player ${data.username} joined`);

        if (this.callbacks.onPlayerJoin) {
            this.callbacks.onPlayerJoin(data);
        }
    }

    _handlePlayerLeave(data) {
        console.log(`Player ${data.playerId} left`);

        if (this.callbacks.onPlayerLeave) {
            this.callbacks.onPlayerLeave(data);
        }
    }

    _handleHit(data) {
        if (this.callbacks.onHit) {
            this.callbacks.onHit({
                shooter: data.shooter,
                target: data.target,
                damage: data.damage,
                weapon: data.weapon
            });
        }
    }

    _handleKill(data) {
        console.log(`${data.killerName} killed ${data.victimName}`);

        if (this.callbacks.onKill) {
            this.callbacks.onKill({
                killer: data.killer,
                killerName: data.killerName,
                victim: data.victim,
                victimName: data.victimName,
                weapon: data.weapon
            });
        }
    }

    _handleRespawn(data) {
        if (this.callbacks.onRespawn) {
            this.callbacks.onRespawn({
                playerId: data.playerId,
                x: data.x,
                y: data.y,
                angle: data.angle
            });
        }
    }

    _handleMatchStart(data) {
        console.log('Match starting!');

        if (this.callbacks.onMatchStart) {
            this.callbacks.onMatchStart({
                duration: data.duration,
                mapSeed: data.mapSeed
            });
        }
    }

    _handleMatchEnd(data) {
        console.log('Match ended!');

        if (this.callbacks.onMatchEnd) {
            this.callbacks.onMatchEnd({
                winner: data.winner,
                scores: data.scores,
                stats: data.stats
            });
        }
    }

    // ============================================
    // RECONNECTION
    // ============================================

    _scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.connect(this.serverUrl, this.farcasterUser);
            }
        }, delay);
    }

    // ============================================
    // EVENT REGISTRATION
    // ============================================

    on(event, callback) {
        const callbackName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
        if (callbackName in this.callbacks) {
            this.callbacks[callbackName] = callback;
        } else {
            console.warn(`Unknown event: ${event}`);
        }
    }

    off(event) {
        const callbackName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
        if (callbackName in this.callbacks) {
            this.callbacks[callbackName] = null;
        }
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const gameClient = new GameClient();
