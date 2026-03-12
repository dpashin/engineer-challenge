# Основные сценарии для ручного тестирования

- [ ] cd ~/engineer-challenge && docker-compose down -v && docker-compose up -d
- [ ] docker-compose ps
- [ ] Регистрация и логин - успех
    - Test1@example.com
    - Открыть http://localhost:4200/register
    - заполнить форму регистрации
    - залогиниться
- [ ] Регистрация - валидация
    - на форме регистрации ввести test2@example.com
    - сабмит формы
    - Пароль должен содержать заглавные и строчные буквы, цифру и спецсимвол
- [ ] Логин - ошибки 
    - несколько раз неверный пароль 
    - 3 раза Invalid email or password.
    - Затем Account is locked (LOGIN_BY_EMAIL)
- [ ] Забыли пароль - успех и replay
    - регистрация нового email
    - переход http://localhost:4200/forgot-password
    - mailcatcher http://localhost:1080/
    - переход из письма
    - Задайте пароль
    - Логин
    - повторный переход из письма
    - ввод новые пароли
    - Попадаем на [Пароль не был восстановлен](http://localhost:4200/password-error)


