#include <iostream>

#include "raylib.h"
#include "raymath.h"


const int screenWidth = 631 + 150;
const int screenHeight = 509 + 150;
const int edgeThreshold = 10;

bool is_between(const int& val, const int& min, const int& max) {
    return val >= min && val <= max;
}

int main(void)
{
    InitWindow(screenWidth, screenHeight, "line analyzer");
    
    Image usaf_target = LoadImage("../resources/usaf_target.png");
    Rectangle usaf_rect = {0, 0, 1.0f * usaf_target.width, 1.0f * usaf_target.height};
    Texture2D texture = LoadTextureFromImage(usaf_target);

    bool toggle = false;
    bool updated = false;
    Vector2 a_pos = {-1, -1};
    Vector2 b_pos = {-1, -1};

    SetTargetFPS(60);
    while (!WindowShouldClose()) 
    {
        BeginDrawing();
        ClearBackground(RAYWHITE);
        
        DrawTexture(texture, 0, 0, WHITE);

        Vector2 mouse_pos = {-1, -1};
        if (IsMouseButtonPressed(0)) {
            Vector2 buffer_mouse_pos = GetMousePosition();
            if (is_between(buffer_mouse_pos.x, 0, usaf_target.width) &&
                is_between(buffer_mouse_pos.y, 0, usaf_target.height))
                mouse_pos = buffer_mouse_pos;
        }
        
        if (!Vector2Equals(mouse_pos, {-1, -1})) {
            updated = true;
            toggle = !toggle;
            if (toggle)
                a_pos = mouse_pos;
            else 
                b_pos = mouse_pos;
        }

        if (CheckCollisionPointRec(a_pos, usaf_rect) && 
            CheckCollisionPointRec(b_pos, usaf_rect)) {
            DrawLineEx(a_pos, b_pos, 3, GRAY);

            int distance = static_cast<int>(Vector2Distance(a_pos, b_pos));

            float left = 10.0f;
            float top = usaf_target.height + 10;
            Vector2 last_point = {-1, -1};
            for (int i = 0; i < distance; i++) {
                double t = static_cast<double>(i) / (distance - 1);
                Color c = GetImageColor(usaf_target, 
                    a_pos.x + (b_pos.x - a_pos.x) * t, 
                    a_pos.y + (b_pos.y - a_pos.y) * t);
                float val = Clamp(
                    Vector3Length({
                        static_cast<float>(c.r),
                        static_cast<float>(c.g),
                        static_cast<float>(c.b)}),
                    0, screenHeight - usaf_target.height - 20
                );
                Vector2 this_point = {left + i, top + val}; 
                if (Vector2Equals(last_point, {-1, -1}))
                    last_point = this_point;

                c = BLACK;
                float diff = this_point.y - last_point.y;
                if (diff > edgeThreshold) {
                    c = RED;
                    if (updated)
                        std::cout << "FALLING " << this_point.x << ", " << this_point.y << std::endl;
                }
                else if (diff < -edgeThreshold) {
                    c = GREEN;
                    if (updated)
                        std::cout << "RISING " << this_point.x << ", " << this_point.y << std::endl;
                }
                DrawLineV(last_point, this_point, c); 
                last_point = this_point;
            }
        }
        DrawCircleV(a_pos, 5, GREEN);
        DrawCircleV(b_pos, 5, RED);
        
        EndDrawing();
        updated = false;
    }
    UnloadTexture(texture);
    UnloadImage(usaf_target);
    CloseWindow(); 
    return 0;
}

