#include <iostream>

#include "raylib.h"
#include "raymath.h"

bool is_between(const int& val, const int& min, const int& max) {
    return val >= min && val <= max;
}

int main(void)
{
    const int screenWidth = 631 + 150;
    const int screenHeight = 509 + 150;
    InitWindow(screenWidth, screenHeight, "line analyzer");
    
    Image usaf_target = LoadImage("../resources/usaf_target.png");
    Rectangle usaf_rect = {0, 0, 1.0f * usaf_target.width, 1.0f * usaf_target.height};
    Texture2D texture = LoadTextureFromImage(usaf_target);

    bool toggle = false;
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
        
        if (mouse_pos.x != -1 && mouse_pos.y != -1) {
            toggle = !toggle;
            if (toggle) a_pos = mouse_pos;
            else b_pos = mouse_pos;
        }

        if (CheckCollisionPointRec(a_pos, usaf_rect) && 
            CheckCollisionPointRec(b_pos, usaf_rect)) {
            DrawLineEx(a_pos, b_pos, 3, GRAY);

            int distance = static_cast<int>(Vector2Distance(a_pos, b_pos));
            for (int i = 0; i < distance; i++) {
                double t = static_cast<double>(i) / (distance - 1);
                Color c = GetImageColor(usaf_target, 
                    a_pos.x + (b_pos.x - a_pos.x) * t, 
                    a_pos.y + (b_pos.y - a_pos.y) * t);
                DrawRectangle(i * 5, usaf_target.height + 50, 5, 5, c); 
            }
        }
        DrawCircleV(a_pos, 5, GREEN);
        DrawCircleV(b_pos, 5, RED);
        
        EndDrawing();
    }
    UnloadTexture(texture);
    UnloadImage(usaf_target);
    CloseWindow(); 
    return 0;
}

