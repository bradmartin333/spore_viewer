#include <iostream>

#include "raylib.h"
#include "raymath.h"

const int imageWidth = 889;
const int imageHeight = 500;
const int screenWidth = imageWidth + 150;
const int screenHeight = imageHeight + 150;
const int edgeThreshold = 10;

bool isBetween(const int& val, const int& min, const int& max) {
    return val >= min && val <= max;
}

int main(void)
{
    InitWindow(screenWidth, screenHeight, "line analyzer");
    
    Image usafTarget = LoadImage("../resources/elp_usaf_target/10x_G3E4_0p.png");
    ImageResizeNN(&usafTarget, imageWidth, imageHeight);
    Rectangle usafRect = {0, 0, 1.0f * imageWidth, 1.0f * imageHeight};
    Texture2D texture = LoadTextureFromImage(usafTarget);

    bool toggle = false;
    bool updated = false;
    Vector2 aPos = {-1, -1};
    Vector2 bPos = {-1, -1};

    SetTargetFPS(60);
    while (!WindowShouldClose()) 
    {
        BeginDrawing();
        ClearBackground(RAYWHITE);
        
        DrawTexture(texture, 0, 0, WHITE);

        Vector2 mousePos = {-1, -1};
        if (IsMouseButtonPressed(0)) {
            Vector2 bufferMousePos = GetMousePosition();
            if (isBetween(bufferMousePos.x, 0, imageWidth) &&
                isBetween(bufferMousePos.y, 0, imageHeight))
                mousePos = bufferMousePos;
        }
        
        if (!Vector2Equals(mousePos, {-1, -1})) {
            updated = true;
            toggle = !toggle;
            if (toggle)
                aPos = mousePos;
            else 
                bPos = mousePos;
        }

        if (CheckCollisionPointRec(aPos, usafRect) && 
            CheckCollisionPointRec(bPos, usafRect)) {
            DrawLineEx(aPos, bPos, 3, GRAY);

            int distance = static_cast<int>(Vector2Distance(aPos, bPos));

            float left = 10.0f;
            float top = imageHeight + 10;
            Vector2 lastPoint = {-1, -1};
            for (int i = 0; i < distance; i++) {
                double t = static_cast<double>(i) / (distance - 1);
                Color c = GetImageColor(usafTarget, 
                    aPos.x + (bPos.x - aPos.x) * t, 
                    aPos.y + (bPos.y - aPos.y) * t);
                float val = Clamp(
                    Vector3Length({
                        static_cast<float>(c.r),
                        static_cast<float>(c.g),
                        static_cast<float>(c.b)}),
                    0, screenHeight - imageHeight - 20
                );
                Vector2 thisPoint = {left + i, top + val}; 
                if (Vector2Equals(lastPoint, {-1, -1}))
                    lastPoint = thisPoint;

                c = BLACK;
                float diff = thisPoint.y - lastPoint.y;
                if (diff > edgeThreshold) {
                    c = RED;
                    if (updated)
                        std::cout << "FALLING " << thisPoint.x << ", " << thisPoint.y << std::endl;
                }
                else if (diff < -edgeThreshold) {
                    c = GREEN;
                    if (updated)
                        std::cout << "RISING " << thisPoint.x << ", " << thisPoint.y << std::endl;
                }
                DrawLineV(lastPoint, thisPoint, c); 
                lastPoint = thisPoint;
            }
        }
        DrawCircleV(aPos, 5, GREEN);
        DrawCircleV(bPos, 5, RED);
        
        EndDrawing();
        updated = false;
    }
    UnloadTexture(texture);
    UnloadImage(usafTarget);
    CloseWindow(); 
    return 0;
}

