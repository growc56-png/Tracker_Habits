# Контракт Backend API для Habits Tracker

Frontend находится в папке `frontend/`. Он не содержит серверной логики и обращается к API через `fetch`.

## Настройка

В начале `app.js` укажи адрес своего сервера:

```js
const API_BASE = "http://localhost:8000/api";
```

Все запросы и ответы ниже используют JSON. Для защищённых ручек frontend отправляет:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Рекомендуемый вариант для production — HttpOnly Secure cookie вместо хранения access token в localStorage. Если используешь cookie, настрой CORS с credentials и адаптируй функцию `api()`.

## 1. Регистрация

**POST** `/api/auth/register`

Тело запроса:

```json
{
  "name": "Семён",
  "email": "semen@example.com",
  "password": "strongPassword123"
}
```

Успешный ответ — **201 Created**:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": 1,
    "name": "Семён",
    "email": "semen@example.com"
  }
}
```

Backend должен проверить корректность email, уникальность email и надёжность пароля. Пароль хранить только в виде безопасного хеша.

## 2. Вход

**POST** `/api/auth/login`

Тело запроса:

```json
{
  "email": "semen@example.com",
  "password": "strongPassword123"
}
```

Успешный ответ — **200 OK**: такой же формат, как у регистрации (`accessToken` и `user`).

## 3. Выход

**POST** `/api/auth/logout`

Заголовок: Bearer token.

Ответ: **200 OK**

```json
{ "message": "Вы вышли из аккаунта" }
```

Если используешь stateless JWT без refresh-токенов, backend может не иметь серверной операции выхода — тогда frontend просто удалит локальную сессию.

## 4. Получить привычки пользователя

**GET** `/api/habits`

Заголовок: Bearer token.

Ответ — **200 OK**:

```json
{
  "habits": [
    {
      "id": 12,
      "title": "Читать 20 минут",
      "dueDate": "2026-11-14",
      "completed": false,
      "completedAt": null,
      "createdAt": "2026-11-13T09:00:00Z"
    }
  ]
}
```

Возвращай только привычки авторизованного пользователя. Сортировку можно делать по дате выполнения.

## 5. Добавить привычку

**POST** `/api/habits`

Тело запроса:

```json
{
  "title": "Читать 20 минут",
  "dueDate": "2026-11-14"
}
```

Успешный ответ — **201 Created**:

```json
{
  "habit": {
    "id": 13,
    "title": "Читать 20 минут",
    "dueDate": "2026-11-14",
    "completed": false,
    "completedAt": null,
    "createdAt": "2026-11-13T09:00:00Z"
  }
}
```

`dueDate` — дата в формате `YYYY-MM-DD`. Привычка должна принадлежать пользователю, который её создал.

## 6. Отметить привычку выполненной / отменить выполнение

**PATCH** `/api/habits/:id/complete`

Например: `PATCH /api/habits/13/complete`

Тело запроса:

```json
{
  "completed": true
}
```

Чтобы отменить отметку, передай `false`.

Ответ — **200 OK**:

```json
{
  "habit": {
    "id": 13,
    "title": "Читать 20 минут",
    "dueDate": "2026-11-14",
    "completed": true,
    "completedAt": "2026-11-13T10:30:00Z"
  }
}
```

При `completed: true` установи `completedAt`, при `false` сбрось его в `null`.

## 7. Удалить привычку

**DELETE** `/api/habits/:id`

Например: `DELETE /api/habits/13`

Ответ — **200 OK**:

```json
{ "message": "Привычка удалена" }
```

Также допустим ответ **204 No Content**.

## Формат ошибок

Возвращай понятное сообщение и подходящий HTTP-статус:

```json
{
  "message": "Пользователь с таким email уже существует"
}
```

Рекомендуемые статусы: 400 — некорректные данные, 401 — не авторизован / неверный пароль, 403 — нет доступа, 404 — привычка не найдена, 409 — конфликт (например, email занят), 500 — внутренняя ошибка.

## Важная логика просрочки

Frontend сам подсвечивает привычку красным, если она не выполнена и `dueDate` меньше сегодняшней даты. Отдельный статус просрочки в базе не обязателен — его можно вычислять на сервере при необходимости. Не удаляй просроченные привычки: они должны оставаться в колонке «В процессе», пока пользователь не выполнит их или не удалит.

## Минимальные модели данных

**User**
- `id`
- `name`
- `email` (unique)
- `passwordHash`

**Habit**
- `id`
- `userId` (внешний ключ на User)
- `title`
- `dueDate` (DATE)
- `completed` (BOOLEAN, default false)
- `completedAt` (nullable timestamp)
- `createdAt` (timestamp)

## CORS

Если frontend и backend работают на разных портах, разреши origin фронтенда, например `http://localhost:5500` или адрес твоего dev-сервера. Разреши методы GET, POST, PATCH, DELETE и заголовки Content-Type, Authorization. Не используй `Access-Control-Allow-Origin: *` вместе с credentials.
