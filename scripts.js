        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const ui = {
            hp: document.getElementById('hp'),
            damage: document.getElementById('damage'),
            level: document.getElementById('level'),
            xp: document.getElementById('xp'),
            xpNext: document.getElementById('xpNext'),
            inventoryButton: document.getElementById('inventoryButton'),
            inventoryMenu: document.getElementById('inventoryMenu')
        };

        canvas.width = Math.min(window.innerWidth, 480);
        canvas.height = Math.min(window.innerHeight - 100, 640);
        const tileSize = 32;

        // Камера
        const camera = { x: 0, y: 0, width: canvas.width, height: canvas.height };

        // Лиса
        const fox = {
            x: 5 * tileSize,
            y: 5 * tileSize,
            speed: 5,
            size: tileSize * 0.75,
            baseSpirit: 100,
            spirit: 100,
            baseClaws: 10,
            claws: 10,
            rank: 1,
            xp: 0,
            xpNext: 100,
            stash: [],
            equipped: [],
            frame: 0,
            direction: 'down'
        };

        // Карта
        let map = [];
        const mapWidth = 50;
        const mapHeight = 40;
        let denCount = 1;

        // Типы деревьев
        const treeTypes = [
            { color: "#4a6f4a", detail: "#3a5f3a" }, // Мягкие зеленые сосны
            { color: "#6f5f4a", detail: "#5f4f3a" }, // Спокойные коричневые дубы
            { color: "#5f6f4a", detail: "#4f5f3a" }  // Приглушенные оливковые ели
        ];
        let currentTreeType = treeTypes[0];

        // Враги
        let foes = [];
        const foeTypes = [
            { name: "Wolf", spiritBase: 40, clawsBase: 8, speedBase: 1, color: "#777", frames: 2, xpBase: 20 },
            { name: "Bear", spiritBase: 60, clawsBase: 15, speedBase: 0.8, color: "#7a4f2f", frames: 2, xpBase: 30 },
            { name: "Owl", spiritBase: 25, clawsBase: 5, speedBase: 1.5, color: "#b0b0b0", frames: 2, xpBase: 15 }
        ];
        const bossFoe = { name: "Forest Spirit", spiritBase: 200, clawsBase: 25, speedBase: 1, color: "#3a8b3a", frames: 2, xpBase: 100, size: tileSize * 1.5 };

        // Ловушки
        let snares = [];
        const snareType = { damage: 10, color: "#6b4e31" }; // Мягкий коричневый для капканов

        // Сокровища
        let treasures = [];
        const treasureTypes = [
            { name: "Fang Charm", type: "weapon", clawsBase: 10, color: "#c0c0c0" },
            { name: "Berry Essence", type: "consumable", spiritBase: 30, color: "#d87093" },
            { name: "Fur Cloak", type: "armor", spiritBase: 15, clawsBase: 5, color: "#e68a00" }
        ];

        // Искры
        let sparks = [];
        const sparkDuration = 500;
        let isTransitioning = false; // Флаг для предотвращения пропуска

        // Управление
        let joystick = { x: 0, y: 0, active: false };

        // Генерация случайных статов
        function randomizeStats(baseObj) {
            const obj = { ...baseObj };
            obj.spirit = obj.spiritBase ? Math.floor(obj.spiritBase * (0.8 + Math.random() * 0.4)) : undefined;
            obj.claws = obj.clawsBase ? Math.floor(obj.clawsBase * (0.8 + Math.random() * 0.4)) : undefined;
            obj.speed = obj.speedBase ? obj.speedBase * (0.9 + Math.random() * 0.2) : undefined;
            obj.xp = obj.xpBase ? Math.floor(obj.xpBase * (0.9 + Math.random() * 0.2)) : undefined;
            return obj;
        }

        // Создание искр
        function spawnSparks() {
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 2;
                sparks.push({
                    x: fox.x + fox.size / 2,
                    y: fox.y + fox.size / 2,
                    dx: Math.cos(angle) * speed,
                    dy: Math.sin(angle) * speed,
                    life: sparkDuration,
                    size: 4 + Math.random() * 4
                });
            }
        }

        // Генерация логова
        function generateDen() {
            map = Array(mapHeight).fill().map(() => Array(mapWidth).fill(1));
            const clearings = [];
            for (let i = 0; i < 12; i++) {
                let w = Math.floor(Math.random() * 8) + 4;
                let h = Math.floor(Math.random() * 8) + 4;
                let x = Math.floor(Math.random() * (mapWidth - w - 1)) + 1;
                let y = Math.floor(Math.random() * (mapHeight - h - 1)) + 1;
                for (let ry = y; ry < y + h; ry++) {
                    for (let rx = x; rx < x + w; rx++) {
                        map[ry][rx] = 0;
                    }
                }
                clearings.push({ x, y, w, h });
            }
            for (let i = 0; i < clearings.length - 1; i++) {
                let c1 = clearings[i];
                let c2 = clearings[i + 1];
                let x1 = c1.x + Math.floor(c1.w / 2);
                let y1 = c1.y + Math.floor(c1.h / 2);
                let x2 = c2.x + Math.floor(c2.w / 2);
                let y2 = c2.y + Math.floor(c2.h / 2);
                while (x1 !== x2) {
                    map[y1][x1] = 0;
                    x1 += x1 < x2 ? 1 : -1;
                }
                while (y1 !== y2) {
                    map[y1][x1] = 0;
                    y1 += y1 < y2 ? 1 : -1;
                }
            }
            currentTreeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];
            spawnFoes();
            spawnTreasures();
            spawnSnares();
            placeFox();
            updateCamera();
            updateStashUI();
            denCount++;
            isTransitioning = false; // Сбрасываем флаг после генерации
        }

        function placeFox() {
            let placed = false;
            while (!placed) {
                fox.x = Math.floor(Math.random() * mapWidth) * tileSize;
                fox.y = Math.floor(Math.random() * mapHeight) * tileSize;
                if (map[Math.floor(fox.y / tileSize)][Math.floor(fox.x / tileSize)] === 0) placed = true;
            }
        }

        function spawnFoes() {
            foes = [];
            if (denCount % 5 === 0) {
                let x, y;
                do {
                    x = Math.floor(Math.random() * mapWidth) * tileSize;
                    y = Math.floor(Math.random() * mapHeight) * tileSize;
                } while (map[Math.floor(y / tileSize)][Math.floor(x / tileSize)] === 1);
                foes.push({ x, y, ...randomizeStats(bossFoe), frame: 0 });
            } else {
                for (let i = 0; i < 15; i++) {
                    let type = foeTypes[Math.floor(Math.random() * foeTypes.length)];
                    let x, y;
                    do {
                        x = Math.floor(Math.random() * mapWidth) * tileSize;
                        y = Math.floor(Math.random() * mapHeight) * tileSize;
                    } while (map[Math.floor(y / tileSize)][Math.floor(x / tileSize)] === 1);
                    foes.push({ x, y, ...randomizeStats(type), frame: 0 });
                }
            }
        }

        function spawnSnares() {
            snares = [];
            for (let i = 0; i < 5; i++) {
                let x, y;
                do {
                    x = Math.floor(Math.random() * mapWidth) * tileSize;
                    y = Math.floor(Math.random() * mapHeight) * tileSize;
                } while (map[Math.floor(y / tileSize)][Math.floor(x / tileSize)] === 1);
                snares.push({ x, y, ...snareType });
            }
        }

        function spawnTreasures() {
            treasures = [];
            for (let i = 0; i < 8; i++) {
                let type = treasureTypes[Math.floor(Math.random() * treasureTypes.length)];
                let x, y;
                do {
                    x = Math.floor(Math.random() * mapWidth) * tileSize;
                    y = Math.floor(Math.random() * mapHeight) * tileSize;
                } while (map[Math.floor(y / tileSize)][Math.floor(x / tileSize)] === 1);
                treasures.push({ x, y, ...randomizeStats(type) });
            }
        }

        // Обновление камеры
        function updateCamera() {
            camera.x = fox.x + fox.size / 2 - camera.width / 2;
            camera.y = fox.y + fox.size / 2 - camera.height / 2;
            camera.x = Math.max(0, Math.min(camera.x, mapWidth * tileSize - camera.width));
            camera.y = Math.max(0, Math.min(camera.y, mapHeight * tileSize - camera.height));
        }

        // Отрисовка
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let startX = Math.floor(camera.x / tileSize);
            let startY = Math.floor(camera.y / tileSize);
            let endX = Math.ceil((camera.x + camera.width) / tileSize);
            let endY = Math.ceil((camera.y + camera.height) / tileSize);

            for (let y = Math.max(0, startY); y < Math.min(mapHeight, endY); y++) {
                for (let x = Math.max(0, startX); x < Math.min(mapWidth, endX); x++) {
                    if (map[y][x] === 1) {
                        ctx.fillStyle = currentTreeType.color;
                        ctx.fillRect(x * tileSize - camera.x, y * tileSize - camera.y, tileSize, tileSize);
                        ctx.fillStyle = currentTreeType.detail;
                        ctx.fillRect(x * tileSize - camera.x + 2, y * tileSize - camera.y + 2, tileSize - 4, tileSize - 4);
                    } else {
                        ctx.fillStyle = "#3f5f3f"; // Мягкая зеленая трава
                        ctx.fillRect(x * tileSize - camera.x, y * tileSize - camera.y, tileSize, tileSize);
                    }
                }
            }

            snares.forEach(snare => {
                ctx.fillStyle = snare.color;
                ctx.fillRect(snare.x - camera.x + 8, snare.y - camera.y + 8, tileSize / 2, tileSize / 2);
            });

            treasures.forEach(treasure => {
                ctx.fillStyle = treasure.color;
                ctx.fillRect(treasure.x - camera.x + 8, treasure.y - camera.y + 8, tileSize / 2, tileSize / 2);
            });

            foes.forEach(foe => {
                ctx.fillStyle = foe.color;
                ctx.fillRect(foe.x - camera.x, foe.y - camera.y, foe.size || tileSize, foe.size || tileSize);
                ctx.fillStyle = "#333"; // Темно-серый центр врагов
                ctx.fillRect(foe.x - camera.x + 8, foe.y - camera.y + 8, (foe.size || tileSize) - 16, (foe.size || tileSize) - 16);
            });

            ctx.fillStyle = "#cc7a00"; // Более мягкий оранжевый для лисы
            ctx.fillRect(fox.x - camera.x, fox.y - camera.y, fox.size, fox.size);
            ctx.fillStyle = "#f0e6d9"; // Кремовый хвост
            ctx.fillRect(fox.x - camera.x + fox.size - 8, fox.y - camera.y + fox.size / 2, 8, 8);

            sparks.forEach(spark => {
                ctx.fillStyle = "#ffcc66"; // Мягкий оранжевый для искр
                ctx.fillRect(spark.x - camera.x, spark.y - camera.y, spark.size, spark.size);
            });

            ui.hp.textContent = fox.spirit;
            ui.damage.textContent = fox.claws;
            ui.level.textContent = fox.rank;
            ui.xp.textContent = fox.xp;
            ui.xpNext.textContent = fox.xpNext;
        }

        // Проверка столкновений
        function checkCollision(x, y, size) {
            const left = Math.floor(x / tileSize);
            const right = Math.floor((x + size - 1) / tileSize);
            const top = Math.floor(y / tileSize);
            const bottom = Math.floor((y + size - 1) / tileSize);

            if (left < 0 || right >= mapWidth || top < 0 || bottom >= mapHeight) return true;

            return (
                map[top][left] === 1 ||
                map[top][right] === 1 ||
                map[bottom][left] === 1 ||
                map[bottom][right] === 1
            );
        }

        // Движение лисы
        function moveFox() {
            if (!joystick.active) return;

            let dx = joystick.x;
            let dy = joystick.y;
            let mag = Math.sqrt(dx * dx + dy * dy);
            if (mag > 0) {
                dx = (dx / mag) * fox.speed;
                dy = (dy / mag) * fox.speed;

                let newX = fox.x + dx;
                let newY = fox.y + dy;

                if (!checkCollision(newX, fox.y, fox.size)) fox.x = newX;
                if (!checkCollision(fox.x, newY, fox.size)) fox.y = newY;

                fox.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
                fox.frame = (fox.frame + 0.1) % 2;
            }
            updateCamera();
        }

        // Движение врагов
        function moveFoes() {
            foes.forEach(foe => {
                let dx = fox.x - foe.x;
                let dy = fox.y - foe.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < tileSize * 3) {
                    dx = (dx / distance) * foe.speed;
                    dy = (dy / distance) * foe.speed;
                    let newX = foe.x + dx;
                    let newY = foe.y + dy;
                    if (!checkCollision(newX, foe.y, foe.size || tileSize)) foe.x = newX;
                    if (!checkCollision(foe.x, newY, foe.size || tileSize)) foe.y = newY;
                }
                foe.frame = (foe.frame + 0.1) % foe.frames;
            });
        }

        // Обновление искр
        function updateSparks(deltaTime) {
            sparks = sparks.filter(spark => {
                spark.x += spark.dx;
                spark.y += spark.dy;
                spark.life -= deltaTime;
                return spark.life > 0;
            });
        }

        // Взаимодействие
        function checkInteractions() {
            treasures = treasures.filter(treasure => {
                if (Math.abs(fox.x - treasure.x) < tileSize && Math.abs(fox.y - treasure.y) < tileSize) {
                    fox.stash.push({ ...treasure });
                    updateStashUI();
                    return false;
                }
                return true;
            });

            snares.forEach(snare => {
                if (Math.abs(fox.x - snare.x) < tileSize && Math.abs(fox.y - snare.y) < tileSize) {
                    fox.spirit -= snare.damage;
                    snares = snares.filter(s => s !== snare);
                }
            });

            foes.forEach(foe => {
                if (Math.abs(fox.x - foe.x) < (foe.size || tileSize) && Math.abs(fox.y - foe.y) < (foe.size || tileSize)) {
                    foe.spirit -= fox.claws;
                    fox.spirit -= foe.claws;
                    if (foe.spirit <= 0) {
                        fox.xp += foe.xp;
                        foes = foes.filter(f => f !== foe);
                        checkRankUp();
                    }
                }
            });

            if (foes.length === 0 && !isTransitioning) {
                isTransitioning = true; // Устанавливаем флаг, чтобы предотвратить повторное срабатывание
                spawnSparks();
                alert("All foes vanquished! Entering next den...");
                setTimeout(() => {
                    generateDen();
                }, sparkDuration);
            }

            if (fox.spirit <= 0) {
                alert("The fox has fallen! Restarting the hunt...");
                generateDen();
                fox.spirit = fox.baseSpirit;
                fox.claws = fox.baseClaws;
                fox.stash = [];
                fox.equipped = [];
                fox.rank = 1;
                fox.xp = 0;
                fox.xpNext = 100;
                denCount = 1;
                sparks = [];
                updateStashUI();
            }
        }

        // Проверка повышения ранга
        function checkRankUp() {
            while (fox.xp >= fox.xpNext) {
                fox.rank++;
                fox.xp -= fox.xpNext;
                fox.xpNext = Math.floor(fox.xpNext * 1.5);
                fox.baseSpirit += 20;
                fox.baseClaws += 5;
                fox.spirit = fox.baseSpirit;
                alert(`Rank up! You are now rank ${fox.rank}. Spirit and Claws increased!`);
                updateFoxStats();
            }
        }

        // Обновление интерфейса тайника
        function updateStashUI() {
            ui.inventoryMenu.innerHTML = '<h3>Fox Stash</h3>';
            if (fox.stash.length === 0) {
                ui.inventoryMenu.innerHTML += '<p>No treasures</p>';
            } else {
                fox.stash.forEach((treasure, index) => {
                    const div = document.createElement('div');
                    div.className = 'inventoryItem';
                    let stats = treasure.name;
                    if (treasure.claws) stats += ` (Claws: ${treasure.claws})`;
                    if (treasure.spirit) stats += ` (Spirit: ${treasure.spirit})`;
                    div.innerHTML = `<span>${stats}</span>`;
                    if (fox.equipped.includes(treasure)) div.classList.add('equipped');

                    const equipButton = document.createElement('button');
                    equipButton.textContent = fox.equipped.includes(treasure) ? 'Unequip' : 'Equip';
                    equipButton.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        handleTreasureEquip(index);
                    });

                    const destroyButton = document.createElement('button');
                    destroyButton.textContent = 'Drop';
                    destroyButton.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        handleTreasureDrop(index);
                    });

                    div.appendChild(equipButton);
                    div.appendChild(destroyButton);
                    ui.inventoryMenu.appendChild(div);
                });
            }
            updateFoxStats();
        }

        // Обработка экипировки/снятия
        function handleTreasureEquip(index) {
            const treasure = fox.stash[index];
            const isEquipped = fox.equipped.includes(treasure);

            if (isEquipped) {
                fox.equipped = fox.equipped.filter(i => i !== treasure);
            } else {
                if (treasure.type === "consumable") {
                    fox.spirit += treasure.spirit || 0;
                    fox.stash.splice(index, 1);
                } else {
                    if (treasure.type === "weapon" && fox.equipped.some(i => i.type === "weapon")) {
                        alert("A fox can only wield one charm at a time!");
                        return;
                    }
                    if (treasure.type === "armor" && fox.equipped.some(i => i.type === "armor")) {
                        alert("A fox can only wear one cloak at a time!");
                        return;
                    }
                    fox.equipped.push(treasure);
                }
            }
            updateStashUI();
        }

        // Обработка выбрасывания
        function handleTreasureDrop(index) {
            const treasure = fox.stash[index];
            fox.stash.splice(index, 1);
            if (fox.equipped.includes(treasure)) {
                fox.equipped = fox.equipped.filter(i => i !== treasure);
            }
            updateStashUI();
        }

        // Обновление статов лисы
        function updateFoxStats() {
            fox.claws = fox.baseClaws;
            fox.spirit = Math.min(fox.spirit, fox.baseSpirit);
            fox.equipped.forEach(treasure => {
                if (treasure.type !== "consumable") {
                    fox.claws += treasure.claws || 0;
                    fox.spirit += treasure.spirit || 0;
                }
            });
            fox.spirit = Math.min(fox.spirit, fox.baseSpirit + fox.equipped.reduce((sum, item) => sum + (item.spirit || 0), 0));
        }

        // Открытие/закрытие тайника
        ui.inventoryButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            ui.inventoryMenu.style.display = ui.inventoryMenu.style.display === 'block' ? 'none' : 'block';
        });

        // Сенсорное управление
        let startX, startY;
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            let touch = e.touches[0];
            startX = touch.clientX - canvas.offsetLeft;
            startY = touch.clientY - canvas.offsetTop;
            joystick.active = true;
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            let touch = e.touches[0];
            joystick.x = (touch.clientX - canvas.offsetLeft) - startX;
            joystick.y = (touch.clientY - canvas.offsetTop) - startY;
        });

        canvas.addEventListener('touchend', () => {
            joystick.active = false;
            joystick.x = 0;
            joystick.y = 0;
        });

        // Игровой цикл
        let lastTime = performance.now();
        function gameLoop(timestamp) {
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            moveFox();
            moveFoes();
            updateSparks(deltaTime);
            checkInteractions();
            draw();
            requestAnimationFrame(gameLoop);
        }

        // Старт
        generateDen();
        requestAnimationFrame(gameLoop);